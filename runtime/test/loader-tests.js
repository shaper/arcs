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
import {assert} from './chai-web.js';
import {Manifest} from '../ts-build/manifest.js';

const loader = new Loader();

describe('loader', function() {
  it('can extract a path', function() {
    assert.equal(loader.path('a/foo'), 'a/');
  });
  it('can join paths', function() {
    assert.equal(loader.join('a/foo', 'b'), 'a/b');
  });
  it('can join an absolute path', function() {
    assert.equal(loader.join('a/foo', 'http://b'), 'http://b');
    assert.equal(loader.join('a/foo', 'https://b'), 'https://b');
  });
  it('can load a particle from a particle spec', async () => {
    const files = [];
    const testLoader = new class extends Loader {
      async requireParticle(fileName) {
        files.push(fileName);
        return {};
      }
    };
    const options = {
      fileName: 'somewhere/something',
      loader: testLoader,
    };
    const manifest = await Manifest.parse(`
        schema A
        schema B
        particle Foo in 'foo.js'
          in A a
          out B b`, options);
    const spec = manifest.findParticleByName('Foo');
    assert.equal(spec.implFile, 'somewhere/foo.js');
    const clazz = await testLoader.loadParticleClass(spec);
    assert.equal(clazz.spec, spec);
    assert.deepEqual(files, ['somewhere/foo.js']);
  });
});
