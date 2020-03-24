/**
 * @license
 * Copyright 2020 Google LLC.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * Code distributed by Google as part of this project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
import {assert} from '../platform/assert-web.js';
import {Id} from '../runtime/id.js';
import {Runtime} from '../runtime/runtime.js';
import {Manifest} from '../runtime/manifest.js';
import {Loader} from '../platform/loader-web.js';
import {IsValidOptions, Recipe, RecipeComponent} from '../runtime/recipe/recipe.js';
import {volatileStorageKeyPrefixForTest} from '../runtime/testing/handle-for-test.js';
import {Arc} from '../runtime/arc.js';
import {RecipeResolver} from '../runtime/recipe/recipe-resolver.js';
import {CapabilitiesResolver, StorageKeyCreatorInfo} from '../runtime/capabilities-resolver.js';
import {Store} from '../runtime/storageNG/store.js';
import {Exists} from '../runtime/storageNG/drivers/driver.js';
import {TypeVariable} from '../runtime/type.js';
import {DatabaseStorageKey, PersistentDatabaseStorageKey} from '../runtime/storageNG/database-storage-key.js';
import {Capabilities} from '../runtime/capabilities.js';

/**
 * Responsible for resolving recipes with storage keys.
 */
export class StorageKeyRecipeResolver {
  private readonly runtime: Runtime;

  constructor(context: Manifest) {
    const loader = new Loader();
    this.runtime = new Runtime({loader, context});
    DatabaseStorageKey.register();
  }

  /**
   * Produces resolved recipes with storage keys.
   *
   * @throws Error if recipe fails to resolve on first or second pass.
   * @returns Resolved recipes (with Storage Keys).
   */
  async resolve(): Promise<Recipe[]> {
    const recipes = [];
    for (const recipe of this.runtime.context.recipes) {
      this.validateHandles(recipe);
      const arcId = findLongRunningArcId(recipe);
      const arc = this.runtime.newArc(
        arcId, volatileStorageKeyPrefixForTest(), arcId ? {id: Id.fromString(arcId)} : undefined);
      const opts = {errors: new Map<Recipe | RecipeComponent, string>()};
      const resolved = await this.tryResolve(recipe, arc, opts);
      if (!resolved) {
        throw Error(`Recipe ${recipe.name} failed to resolve:\n${[...opts.errors.values()].join('\n')}`);
      }
      await this.createStoresForCreateHandles(resolved, arc);
      if (!resolved.isResolved()) {
        throw Error(`Recipe ${resolved.name} did not properly resolve!\n${resolved.toString({showUnresolved: true})}`);
      }
      recipes.push(resolved);
    }
    return recipes;
  }

  /**
   * Resolves unresolved recipe or normalizes resolved recipe.
   *
   * @param recipe long-running or ephemeral recipe
   * @param arc Arc is associated with input recipe
   * @param opts contains `errors` map for reporting.
   */
  async tryResolve(recipe: Recipe, arc: Arc, opts?: IsValidOptions): Promise<Recipe | null> {
    const normalized = recipe.clone();
    const successful = normalized.normalize(opts);
    if (!successful) return null;
    if (normalized.isResolved()) return normalized;

    return await (new RecipeResolver(arc).resolve(recipe, opts));
  }

  /**
   * Create stores with keys for all create handles with ids.
   *
   * @param recipe should be long running.
   * @param arc Arc is associated with current recipe.
   */
  async createStoresForCreateHandles(recipe: Recipe, arc: Arc) {
    const dbKeyCreator: StorageKeyCreatorInfo = {
      protocol: 'db',
      capabilities: Capabilities.persistentQueryable,
      create: options => new PersistentDatabaseStorageKey(options.unique(), options.schemaHash),
    };
    const resolver = new CapabilitiesResolver({arcId: arc.id},
      [dbKeyCreator, ...CapabilitiesResolver.getDefaultCreators()]);
    for (const createHandle of recipe.handles.filter(h => h.fate === 'create' && !!h.id)) {
      if (createHandle.type instanceof TypeVariable && !createHandle.type.isResolved()) {
        // TODO(mmandlis): should already be resolved.
        assert(createHandle.type.maybeEnsureResolved());
        assert(createHandle.type.isResolved());
      }
      const storageKey = await resolver.createStorageKey(
        createHandle.capabilities, createHandle.type.getEntitySchema(), createHandle.id);
      const store = new Store(createHandle.type, {storageKey, exists: Exists.MayExist, id: createHandle.id});
      arc.context.registerStore(store, createHandle.tags);
    }
  }

  /**
   * Checks that handles are existent, disambiguous, and initiated by a long-running arc.
   *
   * @throws when a map or copy handle is associated with too many stores (ambiguous mapping).
   * @throws when a map or copy handle isn't associated with any store (no matches found).
   * @throws when a map or copy handle is associated with a handle from an ephemeral recipe.
   * @param recipe long-running or ephemeral recipe
   */
  validateHandles(recipe: Recipe) {
    recipe.handles
      .filter(h => h.fate === 'map' || h.fate === 'copy')
      .forEach(handle => {
        const matches = this.runtime.context.findHandlesById(handle.id)
          .filter(h => h.fate === 'create');

        if (matches.length === 0) {
          throw Error(`No matching handles found for ${handle.localName}.`);
        } else if (matches.length > 1) {
          throw Error(`More than one handle found for ${handle.localName}.`);
        }

        const match = matches[0];
        if (!isLongRunning(match.recipe)) {
          throw Error(`Handle ${handle.localName} mapped to ephemeral handle ${match.localName}.`);
        }
      });
  }
}

/** Returns true if input recipe is for a long-running arc. */
export function isLongRunning(recipe: Recipe): boolean {
  return !!findLongRunningArcId(recipe);
}

/** Returns arcId for long-running arcs, null otherwise. */
export function findLongRunningArcId(recipe: Recipe): string | null {
  const getTrigger = (group: [string, string][], name: string): string | null => {
    const trigger = group.find(([key, _]) => key === name);
    return trigger ? trigger[1] : null;
  };

  for (const group of recipe.triggers) {
    if (getTrigger(group, 'launch') === 'startup' &&
      !!getTrigger(group, 'arcId')) {
      return getTrigger(group, 'arcId');
    }
  }
  return null;
}
