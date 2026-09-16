#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, readlinkSync, realpathSync, lstatSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { capture } from './capture.mjs';
import { digest, sourceTopologyKey } from './model.mjs';
import { registry, call } from './registry-client.mjs';

const ROOT = fileURLToPath(new URL('../../../../..', import.meta.url));
const DIR = join(ROOT, 'log/twins');
const validId = id => typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(id);
function main(input) {
  const action = input.action;
  if (!action) return { ok: true, status: 'READY', usage: '{"action":"run","taskId":"scan-lan","scan":{"scope":"lan"}}; action=create|status' };
  if (!['run', 'create', 'status'].includes(action)) throw new Error('Nieznana akcja twin');
  if (input.taskId !== undefined && !validId(input.taskId)) throw new Error('Niepoprawne taskId');
  if (action === 'status') {
    if (!validId(input.id)) throw new Error('Wymagany poprawny id bliźniaka');
    const path = join(DIR, input.id, 'receipt.json');
    if (lstatSync(join(DIR, input.id)).isSymbolicLink() || realpathSync(path) !== path) throw new Error('Dowiązanie w ścieżce bliźniaka');
    return { ...JSON.parse(readFileSync(path, 'utf8')), active: false, statusSource: 'completed-run-receipt' };
  }
  const id = `twin-${randomUUID()}`, taskId = input.taskId || `scan-${randomUUID()}`;
  mkdirSync(DIR, { recursive: true, mode: 0o700 });
  if (realpathSync(DIR) !== DIR) throw new Error('Dowiązanie w katalogu bliźniaków');
  const dir = join(DIR, id);
  mkdirSync(dir, { mode: 0o700 });
  const write = (name, value) => writeFileSync(join(dir, name), JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  let receipt = { ok: false, id, taskId, active: false, createdAt: new Date().toISOString(), state: 'CAPTURING' };
  try {
    const snapshot = capture(input);
    write('snapshot.json', snapshot);
    const hostNamespace = readlinkSync('/proc/self/ns/net');
    const r = spawnSync('unshare', ['--user', '--map-root-user', '--net', '--pid', '--fork', '--kill-child',
      process.execPath, fileURLToPath(new URL('./runtime.mjs', import.meta.url))], {
      input: JSON.stringify({ snapshot, hostNamespace }), encoding: 'utf8', timeout: 90000, killSignal: 'SIGKILL',
      maxBuffer: 32 * 1024 * 1024, env: { PATH: process.env.PATH, HOME: process.env.HOME, TASKAND_CALL_DEPTH: process.env.TASKAND_CALL_DEPTH || '0' }
    });
    let runtime;
    try { runtime = JSON.parse(r.stdout); }
    catch { runtime = { ok: false, errorType: 'TWIN_UNAVAILABLE', error: r.error?.message || r.stderr?.trim() || 'Brak wyniku izolowanego runtime' }; }
    if (r.error || r.status !== 0) runtime = { ...runtime, ok: false, errorType: 'TWIN_UNAVAILABLE', error: r.error?.message || r.stderr?.trim() || `exit ${r.status}` };
    write('runtime.json', runtime);
    const current = call(snapshot.scanner.uri, { mode: 'inventory' }, 10000);
    const scannedCidrs = (snapshot.live?.scanned_networks || []).map(n => n.cidr);
    const sourceUnchanged = current.ok && sourceTopologyKey(current.topology, scannedCidrs) === sourceTopologyKey(snapshot.topology, scannedCidrs);
    receipt = { ...receipt, ok: runtime.ok === true && sourceUnchanged, state: runtime.ok && sourceUnchanged ? 'VERIFIED' : 'FAILED',
      sourceUnchanged, snapshotHash: digest(snapshot), catalogHash: snapshot.catalogHash,
      devices: snapshot.live.devices, scanned_networks: snapshot.live.scanned_networks,
      scanner: snapshot.scanner, reused: true, generatedProcesses: 0, organisms: snapshot.organisms.length,
      parity: runtime.parity, scanParity: runtime.scanParity, scannedHosts: runtime.scannedHosts,
      isolated: runtime.isolated === true, materialized: runtime.materialized === true,
      namespace: runtime.namespace, hostNamespace, fullInfrastructure: false,
      networks: snapshot.topology.networks.filter(n => n.family === 4).map(n => ({ interface: n.interface, cidr: n.cidr, range: n.range })),
      fidelity: snapshot.fidelity, dockerInventory: snapshot.docker.ok,
      artifacts: { snapshot: join(dir, 'snapshot.json'), runtime: join(dir, 'runtime.json'), receipt: join(dir, 'receipt.json') },
      ...(!runtime.ok ? { errorType: runtime.errorType || 'TWIN_VERIFICATION_FAILED', error: runtime.error || 'Skan w bliźniaku różni się od źródła' } : {}),
      ...(!sourceUnchanged ? { errorType: 'SOURCE_CHANGED', error: 'Adresacja źródła zmieniła się podczas zadania; wymagany nowy bliźniak' } : {}) };
    receipt.fidelity.networkAddressing = runtime.parity?.ok ? 'verified' : 'unverified';
  } catch (err) { receipt = { ...receipt, state: 'FAILED', errorType: 'TWIN_FAILED', error: err.message }; }
  receipt.finishedAt = new Date().toISOString();
  receipt.summary = receipt.ok ? `Bliźniak ${id}: adresacja zgodna 1:1, zakres skanu URI zweryfikowany; runtime zakończony. Usługi: niepełne odwzorowanie.` : `Bliźniak ${id}: ${receipt.error}`;
  write('receipt.json', receipt);
  registry('audit', { type: 'twin.completed', subject: id, data: { taskId, ok: receipt.ok, snapshotHash: receipt.snapshotHash, scanner: receipt.scanner, sourceUnchanged: receipt.sourceUnchanged } });
  return receipt;
}
let out;
try { const raw = JSON.parse(readFileSync(0, 'utf8').trim() || '{}'); out = main(raw.params || raw); }
catch (err) { out = { ok: false, errorType: 'TWIN_FAILED', error: err.message }; }
process.stdout.write(JSON.stringify(out) + '\n');
