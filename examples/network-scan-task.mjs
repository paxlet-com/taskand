#!/usr/bin/env node
// A real task: select existing URI -> validate DAG -> execute -> assert twin and reuse receipts.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('..', import.meta.url));
function registry(action, payload = {}, timeout = 240000) {
  const r = spawnSync('node', [join(root, 'generated/registry/core/taskand.dev/v1/bin.mjs')], {
    input: JSON.stringify({ action, ...payload }), encoding: 'utf8', timeout, maxBuffer: 32 * 1024 * 1024
  });
  if (r.error) throw r.error;
  return JSON.parse(r.stdout);
}
const call = (uri, input) => registry('call', { uri, input, timeout_ms: 230000 });
const before = registry('list');
const selected = registry('select', { organism: 'admin', capability: 'network-device-discovery' });
assert.equal(selected.ok, true, selected.error);
const taskId = `network-scan-${randomUUID()}`;
const plan = { goal: 'Skan lokalnej sieci i weryfikacja cyfrowego bliźniaka całej adresacji hosta',
  steps: [{ id: 1, name: 'scan_local_network', process: selected.uri, deps: [], params: { scope: 'lan' } }] };
const approved = call('proc://taskand.dev/validator/resolve/v1', { blueprint: plan });
assert.equal(approved.valid, true, JSON.stringify(approved.errors));
const dir = join(root, 'log/tasks');
mkdirSync(dir, { recursive: true, mode: 0o700 });
writeFileSync(join(dir, `${taskId}.json`), JSON.stringify({ taskId, plan, selected }, null, 2), { flag: 'wx', mode: 0o600 });
const result = call('proc://taskand.dev/orchestrator/execute/v1', { runId: taskId, approvedPlan: approved.approvedPlan || plan });
const twin = result.steps?.scan_local_network?.output;
const after = registry('list');
const bindings = catalog => catalog.processes.map(p => `${p.uri}|${p.hash}|${p.status}`).sort();
assert.deepEqual(bindings(before), bindings(after), 'Wykonanie zadania zmieniło pakiety w rejestrze');
console.log(JSON.stringify({ ok: result.ok, taskId, state: result.status, twinId: twin?.id,
  uri: selected.uri, hash: selected.entry.hash, reused: true, generatedProcesses: 0,
  isolated: twin?.isolated, materialized: twin?.materialized, parity: twin?.parity,
  scanParity: twin?.scanParity, scannedHosts: twin?.scannedHosts, sourceUnchanged: twin?.sourceUnchanged,
  networkCount: twin?.networks?.length, lan: twin?.scanned_networks, artifacts: twin?.artifacts, error: twin?.error || result.error }, null, 2));
assert.equal(result.ok, true, twin?.error || result.error || 'Zadanie nie powiodło się');
assert.equal(twin?.parity?.ok, true);
assert.equal(twin?.isolated, true);
assert.equal(twin?.materialized, true);
assert.equal(twin?.sourceUnchanged, true);
