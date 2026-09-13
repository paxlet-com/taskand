// Wymiana rejestrów między węzłami: export (/.well-known/catalog.json) → package → pull (weryfikacja hash → candidate)
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { NODE_ID, parseUri, allEntries, findEntry } from './store.mjs';
import { packageFiles, packageHash, checkPackage } from './package.mjs';
import { register } from './lifecycle.mjs';

export function exportCatalog() {
  const processes = allEntries()
    .filter(e => e.status === 'active')
    .map(({ uri, organism, desc, kind, hash, origin, files }) => ({ uri, organism, desc, kind, hash, origin, files }));
  return { ok: true, standard: 'taskand-registry/1', node: NODE_ID, generated: new Date().toISOString(), processes };
}

export function packagePayload({ uri }) {
  const entry = findEntry(uri);
  if (!entry || entry.status !== 'active') return { ok: false, error: `Brak aktywnego pakietu ${uri}` };
  const { dir } = parseUri(uri);
  if (packageHash(dir) !== entry.hash) return { ok: false, error: `Pakiet ${uri} nie zgadza się z hashem — nie eksportuję` };
  const files = Object.fromEntries(packageFiles(dir).map(name => [name, readFileSync(join(dir, name)).toString('base64')]));
  return { ok: true, node: NODE_ID, uri, hash: entry.hash, files };
}

async function fetchJson(url, init) {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

// Pobiera brakujące pakiety z węzła peer; nigdy nie nadpisuje lokalnych (immutable), zawsze status candidate
export async function pull({ peer, token, uris }) {
  if (!/^https?:\/\//.test(peer || '')) return { ok: false, error: 'Wymagane: peer (http[s]://host:port)' };
  const remote = await fetchJson(`${peer.replace(/\/$/, '')}/.well-known/catalog.json`);
  const wanted = remote.processes.filter(p => !uris || uris.includes(p.uri));
  const report = [];
  for (const proc of wanted) report.push(await pullOne(peer, token, remote.node, proc));
  const imported = report.filter(r => r.result === 'imported').length;
  return { ok: true, peer, remoteNode: remote.node, offered: remote.processes.length, imported, report };
}

async function pullOne(peer, token, remoteNode, proc) {
  const loc = parseUri(proc.uri);
  if (!loc) return { uri: proc.uri, result: 'rejected', reason: 'niepoprawny URI' };
  const local = findEntry(proc.uri);
  if (local) return { uri: proc.uri, result: local.hash === proc.hash ? 'same' : 'conflict', reason: local.hash === proc.hash ? undefined : 'inny hash lokalnie — wersje są niezmienne, opublikuj nową wersję' };
  if (existsSync(loc.dir)) return { uri: proc.uri, result: 'conflict', reason: 'katalog istnieje, ale nie jest zarejestrowany' };
  try {
    const pkg = await fetchJson(`${peer.replace(/\/$/, '')}/api/registry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ action: 'package', uri: proc.uri })
    });
    const payload = pkg.result || pkg;
    if (!payload.ok) return { uri: proc.uri, result: 'rejected', reason: payload.error };
    return install(loc, proc, payload, remoteNode);
  } catch (err) {
    return { uri: proc.uri, result: 'error', reason: err.message };
  }
}

function install(loc, proc, payload, remoteNode) {
  const names = Object.keys(payload.files || {});
  if (names.some(n => !/^[\w.-]+$/.test(n))) return { uri: proc.uri, result: 'rejected', reason: 'niedozwolona nazwa pliku w pakiecie' };
  mkdirSync(loc.dir, { recursive: true });
  for (const name of names) writeFileSync(join(loc.dir, name), Buffer.from(payload.files[name], 'base64'));
  const hash = packageHash(loc.dir);
  const errors = hash !== proc.hash || hash !== payload.hash ? ['hash pakietu ≠ hash w katalogu peer'] : checkPackage(loc.dir, proc.uri);
  if (errors.length) {
    rmSync(loc.dir, { recursive: true, force: true });
    return { uri: proc.uri, result: 'rejected', reason: errors.join('; ') };
  }
  const reg = register({ uri: proc.uri, origin: `peer:${remoteNode}` });
  return { uri: proc.uri, result: reg.ok ? 'imported' : 'rejected', status: reg.entry?.status, reason: reg.error };
}
