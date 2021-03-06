/**
 * @license
 * Copyright (c) 2018 Google Inc. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * Code distributed by Google as part of this project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

export class ArcStoresFetcher {
  constructor(arc, devtoolsChannel) {
    this._arc = arc;

    devtoolsChannel.listen(arc, 'fetch-stores', async () => devtoolsChannel.send({
      messageType: 'fetch-stores-result',
      messageBody: await this._listStores()
    }));
  }

  async _listStores() {
    const find = manifest => {
      let tags = [...manifest.storeTags];
      if (manifest.imports) {
        manifest.imports.forEach(imp => tags = tags.concat(find(imp)));
      }
      return tags;
    };
    return {
      arcStores: await this._digestStores(this._arc.storeTags),
      contextStores: await this._digestStores(find(this._arc.context))
    };
  }

  async _digestStores(stores) {
    const result = [];
    for (const [store, tags] of stores) {
      let value = `(don't know how to dereference)`;
      if (store.toList) {
        value = await store.toList();
      } else if (store.get) {
        value = await store.get();
      }
      result.push({
        name: store.name,
        tags: tags ? [...tags] : [],
        id: store.id,
        storage: store.storageKey,
        type: store.type,
        description: store.description,
        value
      });
    }
    return result;
  }
}
