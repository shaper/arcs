/*
 * Copyright 2020 Google LLC.
 *
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 *
 * Code distributed by Google as part of this project is also subject to an additional IP rights
 * grant found at
 * http://polymer.github.io/PATENTS.txt
 */

package arcs.core.util

/** Provides a platform-independent version of [Time]. */
object PlatformTime {
        val nanoTime: Long
            get() = PlatformTimeProvider.nanoTime
        val currentTimeMillis: Long
            get() = PlatformTimeProvider.currentTimeMillis
}