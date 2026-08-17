#!/usr/bin/env node
// Print "<id-prefix> <STATUS>" for each EAS build ID passed as an argument.
const fs = require('fs');
const os = require('os');
const path = require('path');

const state = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.expo', 'state.json'), 'utf8'));
const token = state.auth.sessionSecret;

(async () => {
  for (const id of process.argv.slice(2)) {
    try {
      const res = await fetch('https://api.expo.dev/graphql', {
        method: 'POST',
        headers: { 'expo-session': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'query($id: ID!){ builds { byId(buildId: $id){ status error { message } } } }',
          variables: { id },
        }),
      });
      const json = await res.json();
      const b = json.data?.builds?.byId;
      console.log(`${id.slice(0, 8)} ${b?.status ?? 'UNKNOWN'}${b?.error ? ' :: ' + b.error.message : ''}`);
    } catch (e) {
      console.log(`${id.slice(0, 8)} POLL_ERROR ${e.message}`);
    }
  }
})();
