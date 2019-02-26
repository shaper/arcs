// process debug flags
import './debug.js';
// optional firebase support
import '../lib/build/firebase.js';
import '../../build/runtime/storage/firebase/firebase-provider.js';
// optional pouchdb support
import '../lib/build/pouchdb.js';
import '../../build/runtime/storage/pouchdb/pouchdb-provider.js';
// whitelist components
import '../configuration/whitelisted.js';
// shell
import './elements/web-shell.js';

import {DevtoolsConnection} from '../../build/runtime/debug/devtools-connection.js';
(async () => {
  const params = (new URL(document.location)).searchParams;
  if (params.has('remote-explore-key')) {
    // Wait for the remote Arcs Explorer to connect before starting the Shell.
    DevtoolsConnection.ensure();
    await DevtoolsConnection.onceConnected;
  }
  // Shell blocks until root is provided
  document.querySelector('web-shell').root = '../..';
  /*
  document.querySelector('body').appendChild(document.createElement('web-shell'));
  // configure root path
  Object.assign(document.querySelector('web-shell'), {
    root: '../..' // path to arcs/
  });
  */
})();
