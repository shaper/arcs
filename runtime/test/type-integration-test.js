/**
 * @license
 * Copyright (c) 2017 Google Inc. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * Code distributed by Google as part of this project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

'use strict';

import {assert} from './chai-web.js';
import {Loader} from '../ts-build/loader.js';
import {Manifest} from '../ts-build/manifest.js';

async function setup() {
  const registry = {};
  const loader = new Loader();
  const manifest = await Manifest.load('./runtime/test/artifacts/type-match.manifest', loader, registry);
  assert(manifest);

  return manifest;
}

describe('type integration', () => {
  it('a subtype matches to a supertype that wants to be read', async () => {
    const manifest = await setup();

    const recipe = manifest.recipes[0];
    assert(recipe.normalize());
    assert(recipe.isResolved());
    assert.equal(recipe.handles.length, 1);
    assert.equal(recipe.handles[0].type.primitiveType().canReadSubset.entitySchema.name, 'Lego');
    assert.equal(recipe.handles[0].type.primitiveType().canWriteSuperset.entitySchema.name, 'Product');
  });

  it('a subtype matches to a supertype that wants to be read when a handle exists', async () => {
    const manifest = await setup();

    const recipe = manifest.recipes[1];
    recipe.handles[0].mapToStorage({id: 'test1', type: manifest.findSchemaByName('Product').entityClass().type.collectionOf()});
    assert(recipe.normalize());
    assert(recipe.isResolved());
    assert.lengthOf(recipe.handles, 1);
    assert.equal(recipe.handles[0].type.primitiveType().entitySchema.name, 'Product');
  });

  it('a subtype matches to a supertype that wants to be read when a handle exists', async () => {
    const manifest = await setup();

    const recipe = manifest.recipes[1];
    recipe.handles[0].mapToStorage({id: 'test1', type: manifest.findSchemaByName('Lego').entityClass().type.collectionOf()});
    assert(recipe.normalize());
    assert(recipe.isResolved());
    assert.lengthOf(recipe.handles, 1);
    assert.equal(recipe.handles[0].type.primitiveType().entitySchema.name, 'Lego');
  });
});
