// Copyright (c) 2018 Google Inc. All rights reserved.
// This code may only be used under the BSD style license found at
// http://polymer.github.io/LICENSE.txt
// Code distributed by Google as part of this project is also
// subject to an additional IP rights grant found at
// http://polymer.github.io/PATENTS.txt

import {Strategy} from '../../strategizer/strategizer.js';
import {Recipe} from '../ts-build/recipe/recipe.js';
import {RecipeUtil} from '../ts-build/recipe/recipe-util.js';
import {Walker} from '../ts-build/recipe/walker.js';
import {Handle} from '../ts-build/recipe/handle.js';
import {Type} from '../ts-build/type.js';
import {assert} from '../../platform/assert-web.js';

// This strategy coalesces unresolved terminal recipes (i.e. those that cannot
// be modified by any strategy apart from this one) by finding unresolved
// use/? handle and finding a matching create/? handle in another recipe and
// merging those.
export class CoalesceRecipes extends Strategy {
  constructor(arc) {
    super();
    this._arc = arc;
  }

  get arc() { return this._arc; }

  getResults(inputParams) {
    // Coalescing for terminal recipes that are either unresolved recipes or have no UI.
    return inputParams.terminal.filter(result => !result.result.isResolved() || result.result.slots.length == 0);
  }

  async generate(inputParams) {
    const arc = this.arc;
    const index = this.arc.recipeIndex;
    await index.ready;

    return Recipe.over(this.getResults(inputParams), new class extends Walker {
      // Find a provided slot for unfulfilled consume connection.
      onSlotConnection(recipe, slotConnection) {
        if (slotConnection.isResolved()) {
          return;
        }
        if (!slotConnection.name || !slotConnection.particle) {
          return;
        }

        if (slotConnection.targetSlot) {
          return;
        }

        // TODO: also support a consume slot connection that is NOT required,
        // but no other connections are resolved.

        const results = [];
        // TODO: It is possible that provided-slot wasn't matched due to different handles, but actually
        // these handles are coalescable? Add support for this.
        for (const providedSlot of index.findProvidedSlot(slotConnection)) {
          // Don't grow recipes above 10 particles, otherwise we might never stop.
          if (recipe.particles.length + providedSlot.recipe.particles.length > 10) continue;

          if (RecipeUtil.matchesRecipe(arc.activeRecipe, providedSlot.recipe)) {
            // skip candidate recipe, if matches the shape of the arc's active recipe
            continue;
          }

          results.push((recipe, slotConnection) => {
            const otherToHandle = index.findCoalescableHandles(recipe, providedSlot.recipe);

            const {cloneMap} = providedSlot.recipe.mergeInto(slotConnection.recipe);
            const mergedSlot = cloneMap.get(providedSlot);
            slotConnection.connectToSlot(mergedSlot);

            this._connectOtherHandles(otherToHandle, cloneMap, false);

            // Clear verbs and recipe name after coalescing two recipes.
            recipe.verbs.splice(0);
            recipe.name = null;
            return 1;
          });
        }

        if (results.length > 0) {
          return results;
        }
      }

      onSlot(recipe, slot) {
        // Find slots that according to their provided-spec must be consumed, but have no consume connection.
        if (slot.consumeConnections.length > 0) {
          return; // slot has consume connections.
        }
        if (!slot.sourceConnection || !slot.sourceConnection.slotSpec.getProvidedSlotSpec(slot.name).isRequired) {
          return; // either a remote slot (no source connection), or a not required one.
        }

        const results = [];
        for (const {slotConn, matchingHandles} of index.findConsumeSlotConnectionMatch(slot)) {
          // Don't grow recipes above 10 particles, otherwise we might never stop.
          if (recipe.particles.length + slotConn.recipe.particles.length > 10) continue;

          if (RecipeUtil.matchesRecipe(arc.activeRecipe, slotConn.recipe)) {
            // skip candidate recipe, if matches the shape of the arc's active recipe
            continue;
          }

          if (RecipeUtil.matchesRecipe(recipe, slotConn.recipe)) {
            // skip candidate recipe, if matches the shape of the currently explored recipe
            continue;
          }

          results.push((recipe, slot) => {
            // Find other handles that may be merged, as recipes are being coalesced.
            const otherToHandle = index.findCoalescableHandles(recipe, slotConn.recipe,
              new Set(slot.handleConnections.map(hc => hc.handle).concat(matchingHandles.map(({handle, matchingConn}) => matchingConn.handle))));

            const {cloneMap} = slotConn.recipe.mergeInto(slot.recipe);
            const mergedSlotConn = cloneMap.get(slotConn);
            mergedSlotConn.connectToSlot(slot);
            for (const {handle, matchingConn} of matchingHandles) {
              // matchingConn in the mergedSlotConnection's recipe should be connected to `handle` in the slot's recipe.
              const mergedMatchingConn = cloneMap.get(matchingConn);
              const disconnectedHandle = mergedMatchingConn.handle;
              const clonedHandle = slot.handleConnections.find(handleConn => handleConn.handle && handleConn.handle.id == handle.id).handle;
              if (disconnectedHandle == clonedHandle) {
                continue; // this handle was already reconnected
              }

              while (disconnectedHandle.connections.length > 0) {
                const conn = disconnectedHandle.connections[0];
                conn.disconnectHandle();
                conn.connectToHandle(clonedHandle);
              }
              recipe.removeHandle(disconnectedHandle);
            }

            this._connectOtherHandles(otherToHandle, cloneMap, false);

            // Clear verbs and recipe name after coalescing two recipes.
            recipe.verbs.splice(0);
            recipe.name = null;

            // TODO: Merge description/patterns of both recipes.
            // TODO: Unify common code in slot and handle recipe coalescing.

            return 1;
          });
        }

        if (results.length > 0) {
          return results;
        }
      }

      onHandle(recipe, handle) {
        if (!index.coalescableFates.includes(handle.fate)
            || handle.id
            || handle.connections.length === 0
            || handle.name === 'descriptions') return;
        const results = [];

        for (const otherHandle of index.findHandleMatch(handle, index.coalescableFates)) {
          // Don't grow recipes above 10 particles, otherwise we might never stop.
          if (recipe.particles.length + otherHandle.recipe.particles.length > 10) continue;

          // This is a poor man's proxy for the other handle being an output of a recipe.
          if (otherHandle.connections.find(conn => conn.direction === 'in')) continue;

          // We ignore type variables not constrained for reading, otherwise
          // generic recipes would apply - which we currently don't want here.
          if (otherHandle.type.hasVariable) {
            let resolved = otherHandle.type.resolvedType();
            // TODO: getContainedType returns non-null for references ... is that correct here?
            resolved = resolved.getContainedType() || resolved;
            if (resolved.isVariable && !resolved.canReadSubset) continue;
          }

          if (RecipeUtil.matchesRecipe(arc.activeRecipe, otherHandle.recipe)) {
            // skip candidate recipe, if matches the shape of the arc's active recipe
            continue;
          }

          if (RecipeUtil.matchesRecipe(recipe, otherHandle.recipe)) {
            // skip candidate recipe, if matches the shape of the currently explored recipe
            continue;
          }

          results.push((recipe, handle) => {
            // Find other handles in the original recipe that could be coalesced with handles in otherHandle's recipe.
            const otherToHandle = index.findCoalescableHandles(recipe, otherHandle.recipe, new Set([handle, otherHandle]));

            const {cloneMap} = otherHandle.recipe.mergeInto(handle.recipe);

            // Connect the handle that the recipes are being coalesced on.
            cloneMap.get(otherHandle).mergeInto(handle);

            // Connect all other connectable handles.
            this._connectOtherHandles(otherToHandle, cloneMap, true);

            // Clear verbs and recipe name after coalescing two recipes.
            recipe.verbs.splice(0);
            recipe.name = null;

            // TODO: Merge description/patterns of both recipes.

            return 1;
          });
        }

        return results;
      }

      _connectOtherHandles(otherToHandle, cloneMap, verifyTypes) {
        otherToHandle.forEach((otherHandle, handle) => {
          const otherHandleClone = cloneMap.get(otherHandle);

          // For coalescing that was triggered by handle coalescing (vs slot or slot connection)
          // once the main handle (one that triggered coalescing) was coalesced, types may have changed.
          // Need to verify all the type information for the "other" coalescable handles is still valid.

          // TODO(mmandlis): This is relying on only ever considering a single "other" handles to coalesce,
          // so the handle either is still a valid match or not.
          // In order to do it right for multiple handles, we need to try ALL handles,
          // then fallback to all valid N-1 combinations, then N-2 etc.
          if (verifyTypes) {
            if (!this._reverifyHandleTypes(handle, otherHandleClone)) {
              return;
            }
          }

          otherHandleClone.mergeInto(handle);
        });
      }

      // Returns true, if both handles have types that can be coalesced.
      _reverifyHandleTypes(handle, otherHandle) {
        assert(handle.recipe == otherHandle.recipe);
        const cloneMap = new Map();
        const recipeClone = handle.recipe.clone(cloneMap);
        recipeClone.normalize();
        return Handle.effectiveType(cloneMap.get(handle).type,
            [...cloneMap.get(handle).connections, ...cloneMap.get(otherHandle).connections]);
      }

    }(Walker.Independent), this);
  }
}
