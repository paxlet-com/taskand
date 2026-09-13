#!/usr/bin/env node
// proc://taskand.dev/registry/core/v1 — rejestr procesów węzła: wywołania przez URI, cykl życia pakietów, federacja
// in: { action, ... }  akcje: call resolve list register refresh approve deprecate verify scan export package pull policy audit
import { readFileSync } from 'node:fs';
import { call, resolve } from './exec.mjs';
import { register, refresh, approve, deprecate, list, verify, scan } from './lifecycle.mjs';
import { exportCatalog, packagePayload, pull } from './federation.mjs';
import { policy, audit, readPeers, addPeer, removePeer } from './store.mjs';

const ACTIONS = {
  call,
  resolve: ({ uri }) => resolve(uri),
  list,
  register,
  refresh,
  approve,
  deprecate,
  verify,
  scan,
  export: exportCatalog,
  package: packagePayload,
  pull,
  policy: ({ name }) => ({ ok: true, name, value: policy(name, null) }),
  peers: () => ({ ok: true, peers: readPeers() }),
  peer_add: ({ url }) => addPeer(url),
  peer_remove: ({ url }) => removePeer(url),
  // Zdarzenia organizmów trafiają do wspólnego dziennika z prefiksem organism.* (nie mogą podszyć się pod registry.*)
  audit: ({ type, subject, data }) => {
    if (!/^[a-z][\w.-]{0,60}$/.test(type || '')) return { ok: false, error: 'Wymagane: type (a-z, ., -)' };
    audit(`organism.${type}`, subject, data);
    return { ok: true };
  }
};

let input;
try {
  const raw = readFileSync(0, 'utf8').trim();
  input = raw ? JSON.parse(raw) : {};
} catch {
  process.exit(2);
}

// AbortSignal.timeout nie podtrzymuje pętli zdarzeń — bez tego zawieszone połączenie kończy proces kodem 13 bez wyjścia
setInterval(() => {}, 60000);
const action = ACTIONS[input.action];
let out;
try {
  out = action ? await action(input) : { ok: true, usage: 'registry/core: {"action": "<akcja>", ...}', actions: Object.keys(ACTIONS) };
} catch (err) {
  out = { ok: false, errorType: 'REGISTRY_ERROR', error: err.message };
}
// exit dopiero po opróżnieniu stdout — duże odpowiedzi (list/export/package) nie są obcinane na potoku
process.stdout.write(JSON.stringify(out) + '\n', () => process.exit(0));
