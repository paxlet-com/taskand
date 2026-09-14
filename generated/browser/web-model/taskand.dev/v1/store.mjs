import { mkdirSync, readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';

const ROOT = fileURLToPath(new URL('../../../../..', import.meta.url));
const BASE = join(ROOT, 'log/web-models');
export const hash = value => 'sha256:' + createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export const validId = id => /^webmodel-[a-f0-9-]{36}$/.test(id || '');
export function createStore() {
  mkdirSync(BASE, { recursive: true, mode: 0o700 });
  if (realpathSync(BASE) !== BASE) throw new Error('Dowiązanie w katalogu modeli');
  const id = `webmodel-${randomUUID()}`, path = join(BASE, id);
  mkdirSync(path, { mode: 0o700 });
  return { id, path };
}
export function modelPath(id) {
  if (!validId(id)) throw new Error('Niepoprawne modelId');
  const path = join(BASE, id);
  if (realpathSync(path) !== path) throw new Error('Dowiązanie w ścieżce modelu');
  return path;
}
export function save(path, name, data) {
  if (!/^[a-z0-9-]+\.(json|png)$/.test(name)) throw new Error('Niepoprawna nazwa artefaktu');
  writeFileSync(join(path, name), Buffer.isBuffer(data) ? data : JSON.stringify(data, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}
export function load(id) {
  const path = modelPath(id), text = readFileSync(join(path, 'snapshot.json'), 'utf8');
  const manifest = JSON.parse(readFileSync(join(path, 'manifest.json'), 'utf8'));
  const snapshot = JSON.parse(text);
  if (hash(snapshot) !== manifest.snapshotHash) throw new Error('Niezgodny hash migawki');
  return { path, snapshot, manifest };
}
