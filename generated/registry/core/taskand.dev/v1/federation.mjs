// Bounded peer exchange. Import publishes verified bytes before registering a candidate.
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, mkdtempSync,
  renameSync, lstatSync, openSync, closeSync, fsyncSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { NODE_ID, parseUri, allEntries, findEntry } from './store.mjs';
import { packageFiles, packageHash, checkPackage } from './package.mjs';
import { register } from './lifecycle.mjs';

const MAX_CATALOG_BYTES = 1024 * 1024;
const MAX_RESPONSE_BYTES = 24 * 1024 * 1024;
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_PACKAGE_BYTES = 16 * 1024 * 1024;
const MAX_FILES = 128;
const MAX_CATALOG_ENTRIES = 256;
const MAX_PULL = 16;
const HASH = /^sha256:[0-9a-f]{64}$/;
const URI = /^proc:\/\/taskand\.dev\/[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*\/v[0-9]+$/;
const validUri = value => typeof value === 'string' && value.length <= 512 && URI.test(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
class PeerBusyError extends Error {}

export function exportCatalog() {
  const processes = allEntries().filter(e => e.status === 'active')
    .map(({ uri, organism, desc, kind, hash, origin, files, inputSchema, outputSchema, mcp }) => ({
      uri, organism, desc, kind, hash, origin, files,
      ...(inputSchema ? { inputSchema } : {}), ...(outputSchema ? { outputSchema } : {}), ...(mcp ? { mcp } : {})
    }));
  return { ok: true, standard: 'taskand-registry/1', node: NODE_ID, generated: new Date().toISOString(), processes };
}

export function packagePayload({ uri }) {
  const entry = findEntry(uri);
  if (!entry || entry.status !== 'active') return { ok: false, error: 'Package is not active' };
  const { dir } = parseUri(uri);
  if (packageHash(dir) !== entry.hash) return { ok: false, error: 'Package content does not match registry digest' };
  const names = packageFiles(dir);
  let size = 0;
  if (names.length > MAX_FILES) return { ok: false, error: 'Package file count exceeds limit' };
  const files = {};
  for (const name of names) {
    const bytes = lstatSync(join(dir, name)).size;
    size += bytes;
    if (bytes > MAX_FILE_BYTES || size > MAX_PACKAGE_BYTES) return { ok: false, error: 'Package size exceeds limit' };
    files[name] = readFileSync(join(dir, name)).toString('base64');
  }
  return { ok: true, node: NODE_ID, uri, hash: entry.hash, files };
}

function peerOrigin(value) {
  if (typeof value !== 'string' || /[^\x21-\x7e]|[%\\?#]/.test(value)) throw new Error('Invalid peer origin');
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
      || url.pathname !== '/' || url.search || url.hash || url.port === '0') throw new Error('Invalid peer origin');
  return url.origin;
}

async function fetchJson(url, limit, init = {}) {
  const response = await fetch(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(10000) });
  if (response.status !== 200 || !response.body) {
    await response.body?.cancel();
    if (response.status === 503) throw new PeerBusyError('Peer catalog is busy');
    throw new Error('Peer request failed or redirected');
  }
  const length = response.headers.get('content-length');
  if ((length !== null && (!/^\d+$/.test(length) || Number(length) > limit))
      || ![null, 'identity'].includes(response.headers.get('content-encoding'))) {
    await response.body.cancel();
    throw new Error('Unsupported or oversized peer response');
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.length;
    if (total > limit) throw new Error('Peer response exceeds size limit');
    chunks.push(chunk);
  }
  if (length !== null && total !== Number(length)) throw new Error('Truncated peer response');
  const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
  if (!object(data)) throw new Error('Peer response must be an object');
  return data;
}

export async function pull({ peer, token, uris, expected }) {
  const origin = peerOrigin(peer);
  if (token != null && (typeof token !== 'string' || !/^[\x21-\x7e]{1,4096}$/.test(token))) throw new Error('Invalid peer credential');
  if (uris != null && (!Array.isArray(uris) || uris.length > MAX_PULL || new Set(uris).size !== uris.length || !uris.every(validUri))) {
    throw new Error('Requested URI list is invalid or exceeds limit');
  }
  if (expected != null && (!object(expected) || !Array.isArray(uris)
      || Object.keys(expected).length !== uris.length || !uris.every(uri => HASH.test(expected[uri] || '')))) {
    throw new Error('Expected package pins must match requested URIs');
  }
  // Catalog is public. Credentials are sent only to the exact origin's package endpoint.
  let remote;
  try {
    remote = await fetchJson(origin + '/.well-known/catalog.json', MAX_CATALOG_BYTES);
  } catch (error) {
    if (error instanceof PeerBusyError) {
      return { ok: false, errorType: 'BUSY', error: 'Peer catalog is busy; retry later', retryable: true };
    }
    throw error;
  }
  if (remote.ok !== true || remote.standard !== 'taskand-registry/1' || !Array.isArray(remote.processes)
      || remote.processes.length > MAX_CATALOG_ENTRIES || typeof remote.node !== 'string' || remote.node.length > 256) {
    throw new Error('Invalid peer catalog');
  }
  const catalog = new Map();
  for (const proc of remote.processes) {
    if (!object(proc) || !validUri(proc.uri) || typeof proc.hash !== 'string' || !HASH.test(proc.hash) || catalog.has(proc.uri)) {
      throw new Error('Invalid or duplicate peer catalog entry');
    }
    catalog.set(proc.uri, proc);
  }
  const selected = uris ?? [...catalog.keys()];
  if (selected.length > MAX_PULL) throw new Error('Select at most 16 package URIs per pull');
  const report = [];
  for (const uri of selected) {
    const proc = catalog.get(uri);
    if (!proc || (expected && proc.hash !== expected[uri])) {
      report.push({ uri, result: 'rejected', reason: 'Catalog changed after selection' });
      continue;
    }
    report.push(await pullOne(origin, token, remote.node, proc));
  }
  return { ok: true, peer: origin, remoteNode: remote.node, offered: remote.processes.length,
    imported: report.filter(r => r.result === 'imported').length, report };
}

function existingPackage(loc, proc, remoteNode) {
  const entry = findEntry(proc.uri);
  if (entry && entry.hash !== proc.hash) return { uri: proc.uri, result: 'conflict', reason: 'Immutable URI already has another digest' };
  if (!existsSync(loc.dir)) return entry ? { uri: proc.uri, result: 'conflict', reason: 'Registered package is missing' } : null;
  // Never delete or overwrite another writer's directory. A complete, matching
  // orphan from an interrupted register can be safely registered as a candidate.
  if (lstatSync(loc.dir).isSymbolicLink() || !lstatSync(loc.dir).isDirectory()
      || checkPackage(loc.dir, proc.uri).length || packageHash(loc.dir) !== proc.hash) {
    return { uri: proc.uri, result: 'conflict', reason: 'Existing package content is invalid or different' };
  }
  if (entry) return { uri: proc.uri, result: 'same', status: entry.status };
  const reg = register({ uri: proc.uri, origin: `peer:${remoteNode}`, hold: true });
  return { uri: proc.uri, result: reg.ok ? 'imported' : 'rejected', status: reg.entry?.status,
    ...(reg.ok ? { recovered: true } : { reason: 'Candidate registration failed' }) };
}

async function pullOne(peer, token, remoteNode, proc) {
  try {
    const loc = parseUri(proc.uri);
    if (!loc) return { uri: proc.uri, result: 'rejected', reason: 'Invalid process URI' };
    const existing = existingPackage(loc, proc, remoteNode);
    if (existing) return existing;
    const pkg = await fetchJson(peer + '/api/registry', MAX_RESPONSE_BYTES, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ action: 'package', uri: proc.uri })
    });
    const payload = pkg.result ?? pkg;
    if (!object(payload) || payload.ok !== true || payload.uri !== proc.uri || payload.hash !== proc.hash || !object(payload.files)) {
      return { uri: proc.uri, result: 'rejected', reason: 'Package identity/digest does not match selection' };
    }
    return install(loc, proc, payload, remoteNode);
  } catch {
    return { uri: proc.uri, result: 'error', reason: 'Package transfer or installation failed' };
  }
}

function syncDirectory(path) {
  if (process.platform === 'win32') return;
  const fd = openSync(path, 'r');
  try { fsyncSync(fd); } finally { closeSync(fd); }
}

function install(loc, proc, payload, remoteNode) {
  const names = Object.keys(payload.files);
  if (!names.length || names.length > MAX_FILES || names.some(n => !/^[\w][\w.-]{0,254}$/.test(n))) {
    return { uri: proc.uri, result: 'rejected', reason: 'Invalid package file inventory' };
  }
  let total = 0;
  const files = new Map();
  for (const name of names) {
    const value = payload.files[name];
    // Decode only bounded input and require an exact canonical round trip.
    // A repeated-group base64 regex can exhaust V8's stack on valid large files.
    if (typeof value !== 'string' || value.length > Math.ceil(MAX_FILE_BYTES / 3) * 4) {
      return { uri: proc.uri, result: 'rejected', reason: 'Invalid or oversized base64 file' };
    }
    const bytes = Buffer.from(value, 'base64'); total += bytes.length;
    if (bytes.toString('base64') !== value || bytes.length > MAX_FILE_BYTES || total > MAX_PACKAGE_BYTES) {
      return { uri: proc.uri, result: 'rejected', reason: 'Package exceeds size limit or has invalid base64' };
    }
    files.set(name, bytes);
  }
  // parseUri checks every existing path component for symlinks before this mkdir.
  const parent = dirname(loc.dir);
  mkdirSync(parent, { recursive: true });
  parseUri(proc.uri);
  const stage = mkdtempSync(join(parent, '.incoming-'));
  try {
    for (const [name, bytes] of files) {
      const file = join(stage, name);
      writeFileSync(file, bytes, { flag: 'wx', mode: 0o644 });
      const fd = openSync(file, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); }
    }
    if (packageHash(stage) !== proc.hash || checkPackage(stage, proc.uri).length) {
      return { uri: proc.uri, result: 'rejected', reason: 'Package content or manifest does not match selection' };
    }
    syncDirectory(stage);
    const existing = existingPackage(loc, proc, remoteNode);
    if (existing) return existing;
    try { renameSync(stage, loc.dir); }
    catch (error) {
      if (!['EEXIST', 'ENOTEMPTY'].includes(error.code)) throw error;
      return existingPackage(loc, proc, remoteNode) ?? { uri: proc.uri, result: 'conflict', reason: 'Concurrent package installation' };
    }
    syncDirectory(parent);
    const reg = register({ uri: proc.uri, origin: `peer:${remoteNode}`, hold: true });
    return { uri: proc.uri, result: reg.ok ? 'imported' : 'rejected', status: reg.entry?.status,
      ...(!reg.ok ? { reason: 'Candidate registration failed' } : {}) };
  } finally {
    // Only this process's private staging path can be removed on failure.
    rmSync(stage, { recursive: true, force: true });
  }
}
