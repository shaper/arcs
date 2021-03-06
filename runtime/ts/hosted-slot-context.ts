/**
 * @license
 * Copyright (c) 2018 Google Inc. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * Code distributed by Google as part of this project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import {assert} from '../../platform/assert-web.js';
import {SlotContext} from './slot-context.js';
import {HostedSlotConsumer} from './hosted-slot-consumer.js';
import { Handle } from './recipe/handle.js';

export class HostedSlotContext extends SlotContext {
  // This is a context of a hosted slot, can only contain a hosted slot.
  constructor(id, providedSpec, hostedSlotConsumer) {
    super(id, providedSpec.name, providedSpec.tags, /* container= */ null, providedSpec, hostedSlotConsumer);
    assert(this.sourceSlotConsumer instanceof HostedSlotConsumer);
    const hostedSourceSlotConsumer = this.sourceSlotConsumer as HostedSlotConsumer;
    if (hostedSourceSlotConsumer.storeId) {
      // TODO(mmandlis): This up-cast is dangerous. Why do we need to fake a Handle here?
      this.handles = [{id: hostedSourceSlotConsumer.storeId} as Handle];
    }
  }
}
