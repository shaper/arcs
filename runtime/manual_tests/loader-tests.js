/**
 * @license
 * Copyright (c) 2017 Google Inc. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * Code distributed by Google as part of this project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import {Loader} from '../ts-build/loader.js';
import {assert} from '../test/chai-web.js';
import {Manifest} from '../ts-build/manifest.js';

const loader = new Loader();

describe('loader', function() {
  it('correctly loads Thing as a dependency', async () => {
    const schemaString = await loader.loadResource('http://schema.org/Product');
    const manifest = await Manifest.parse(schemaString, {loader, fileName: 'http://schema.org/Product'});
    assert.equal(manifest.schemas.Product.fields.description, 'Text');
  }).timeout(10000);

  it('can read a schema.org schema that aliases another type', async () => {
    const schemaString = await loader.loadResource('http://schema.org/Restaurant');
    const manifest = await Manifest.parse(schemaString, {loader, fileName: 'http://schema.org/Restaurant'});
    assert.equal(manifest.schemas.Restaurant.fields.servesCuisine, 'Text');
  }).timeout(10000);

  it('can read a schema.org schema with multiple inheritance', async () => {
    const schemaString = await loader.loadResource('http://schema.org/LocalBusiness');
    const manifest = await Manifest.parse(schemaString, {loader, fileName: 'http://schema.org/LocalBusiness'});
    assert.equal(manifest.schemas.LocalBusiness.fields.duns, 'Text');
    assert.equal(manifest.schemas.LocalBusiness.fields.branchCode, 'Text');
  }).timeout(10000);
});
