// Rejestry organizmów: generated/<organism>/registry.json (jedyny zapisujący: registry/core, z blokadą)
import { readFileSync, writeFileSync, readdirSync, existsSync, openSync, closeSync, unlinkSync, statSync, renameSync, appendFileSync, chownSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { hostname } from 'node:os';

export const ROOT = fileURLToPath(new URL('../../../../..', import.meta.url)).replace(/\/$/, '');
export const GEN = join(ROOT, 'generated');
export const NODE_ID = process.env.TASKAND_NODE || hostname();
const GENOME = join(ROOT, 'genome.yaml');
const URI_RE = /^proc:\/\/taskand\.dev\/([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9-]*)\/(v[0-9]+)$/;
const LOCK_WAIT_MS = 10000;
const LOCK_STALE_MS = 30000;

// URI → lokalizacja pakietu; tylko przez regex (bez replace na ścieżkę → brak path traversal)
export function parseUri(uri) {
  const m = URI_RE.exec(String(uri || ''));
  if (!m) return null;
  const [, organism, capability, version] = m;
  return { uri, organism, capability, version, dir: join(GEN, organism, capability, 'taskand.dev', version) };
}

const registryFile = organism => join(GEN, organism, 'registry.json');

export function readRegistry(organism) {
  try {
    return JSON.parse(readFileSync(registryFile(organism), 'utf8'));
  } catch {
    return { organism, node: NODE_ID, processes: {} };
  }
}

export function organisms() {
  return readdirSync(GEN, { withFileTypes: true })
    .filter(d => d.isDirectory() && /^[a-z0-9]/.test(d.name))
    .map(d => d.name)
    .sort();
}

export function allEntries() {
  return organisms().flatMap(o => Object.values(readRegistry(o).processes));
}

export function findEntry(uri) {
  const loc = parseUri(uri);
  return loc ? readRegistry(loc.organism).processes[uri] || null : null;
}

// Gdy registry działa jako root (kontener), pliki przejmują właściciela katalogu generated/ z hosta
export function adoptOwnership(path) {
  if (process.getuid?.() !== 0) return;
  const { uid, gid } = statSync(GEN);
  const walk = p => {
    chownSync(p, uid, gid);
    if (statSync(p).isDirectory()) readdirSync(p).forEach(f => walk(join(p, f)));
  };
  walk(path);
}

const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// Zapis rejestru organizmu pod blokadą O_EXCL (równoległe ewolucje nie nadpisują się nawzajem)
export function updateRegistry(organism, mutate) {
  const lock = join(GEN, organism, '.registry.lock');
  const deadline = Date.now() + LOCK_WAIT_MS;
  let fd;
  while (fd === undefined) {
    try {
      fd = openSync(lock, 'wx');
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      try {
        if (Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS) unlinkSync(lock);
      } catch {}
      if (Date.now() > deadline) throw new Error(`Blokada rejestru ${organism} zajęta > ${LOCK_WAIT_MS} ms`);
      sleep(50);
    }
  }
  try {
    const reg = readRegistry(organism);
    const result = mutate(reg);
    reg.node = NODE_ID;
    reg.updated = new Date().toISOString();
    const tmp = `${registryFile(organism)}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(reg, null, 2) + '\n');
    renameSync(tmp, registryFile(organism));
    adoptOwnership(join(GEN, organism));
    return result;
  } finally {
    closeSync(fd);
    unlinkSync(lock);
  }
}

export function policy(name, fallback) {
  try {
    const m = readFileSync(GENOME, 'utf8').match(new RegExp(`^policy:[\\s\\S]*?^\\s+${name}:\\s*([\\w-]+)`, 'm'));
    return m ? m[1] : fallback;
  } catch {
    return fallback;
  }
}

// Peery (adresy węzłów) z genome.yaml: `peers:` jako lista blokowa `  - http://host:port` lub inline `[]`
export function readPeers() {
  try {
    const text = readFileSync(GENOME, 'utf8');
    const block = text.match(/^peers:\s*(\[\s*\])?\s*$([\s\S]*?)^(?=\S)/m);
    if (!block) return [];
    return [...(block[2] || '').matchAll(/^\s*-\s*(\S+)\s*$/gm)].map(m => m[1].replace(/\/$/, ''));
  } catch {
    return [];
  }
}

function writePeers(peers) {
  const text = readFileSync(GENOME, 'utf8');
  const body = peers.length ? '\n' + peers.map(p => `  - ${p}`).join('\n') + '\n' : ' []\n';
  const replaced = text.replace(/^peers:.*(?:\n {2}-.*)*\n/m, `peers:${body}`);
  writeFileSync(GENOME, replaced === text && !/^peers:/m.test(text) ? `${text.replace(/\n*$/, '\n')}peers:${body}` : replaced);
}

export function addPeer(url) {
  const clean = String(url || '').replace(/\/$/, '');
  if (!/^https?:\/\/[^\s/]+$/.test(clean)) return { ok: false, error: `Niepoprawny adres peera: ${url}` };
  const peers = readPeers();
  if (peers.includes(clean)) return { ok: true, peers, unchanged: true };
  peers.push(clean);
  writePeers(peers);
  audit('cluster.peer_add', clean, {});
  return { ok: true, peers };
}

export function removePeer(url) {
  const clean = String(url || '').replace(/\/$/, '');
  const peers = readPeers().filter(p => p !== clean);
  writePeers(peers);
  audit('cluster.peer_remove', clean, {});
  return { ok: true, peers };
}

export function addToGenome(organism, uri, desc) {
  if (!existsSync(GENOME)) return;
  const text = readFileSync(GENOME, 'utf8');
  if (text.includes(uri)) return;
  const line = `      - { uri: ${uri}, desc: ${JSON.stringify(desc)} }\n`;
  const header = `  - name: ${organism}\n    processes:\n`;
  const idx = text.indexOf(header);
  if (idx < 0) {
    // Sekcja organisms: jest ostatnia w genome.yaml — nowy organizm na końcu pliku
    writeFileSync(GENOME, `${text.replace(/\n*$/, '\n')}\n${header}${line}`);
    return;
  }
  const rest = text.slice(idx + header.length);
  const end = rest.search(/^(?! {6}- )/m);
  const at = idx + header.length + (end < 0 ? rest.length : end);
  writeFileSync(GENOME, text.slice(0, at) + line + text.slice(at));
}

// Audyt w formacie CloudEvents 1.0 (append-only)
export function audit(type, subject, data) {
  const event = { specversion: '1.0', id: `${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`, source: `taskand://${NODE_ID}/registry`, type: `dev.taskand.${type}`, subject, time: new Date().toISOString(), data };
  try {
    appendFileSync(join(ROOT, 'log', 'events.jsonl'), JSON.stringify(event) + '\n');
  } catch {}
}
