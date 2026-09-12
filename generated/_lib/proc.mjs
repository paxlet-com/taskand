// taskand v2.2 — wspólny runtime procesów: ROOT, I/O kontraktu, wywołania proc://
import { readFileSync, existsSync, statSync, chownSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, relative, sep } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = existsSync('/taskand/generated') ? '/taskand' : resolve(here, '../..');
export const GEN = join(ROOT, 'generated');

// Kontrakt wejścia: JSON na stdin; niepoprawny JSON → exit 2
export function readInput() {
  try {
    const raw = readFileSync(0, 'utf8').trim();
    return raw ? JSON.parse(raw) : {};
  } catch {
    process.exit(2);
  }
}

export function emit(obj, code = 0) {
  process.stdout.write(JSON.stringify(obj) + '\n');
  process.exit(code);
}

// Pliki tworzone przez kontener (root) przejmują właściciela katalogu generated/ z hosta
export function adoptOwnership(dir) {
  if (process.getuid?.() !== 0) return;
  const { uid, gid } = statSync(GEN);
  const walk = p => {
    chownSync(p, uid, gid);
    if (statSync(p).isDirectory()) readdirSync(p).forEach(f => walk(join(p, f)));
  };
  // Od pierwszego katalogu pod generated/, bo mkdir -p mógł utworzyć kilka poziomów
  walk(join(GEN, relative(GEN, dir).split(sep)[0]));
}

// proc://taskand.dev/<a>/<b>/<ver> → generated/<a>/<b>/taskand.dev/<ver>/bin.mjs
export function uriToPath(uri) {
  const parts = uri.replace('proc://taskand.dev/', '').split('/').filter(Boolean);
  if (parts.length < 2 || parts.some(p => p === '..' || p.startsWith('.'))) return null;
  const ver = parts.pop();
  return join(GEN, ...parts, 'taskand.dev', ver, 'bin.mjs');
}

// Wywołuje proces i zwraca sparsowane wyjście; nigdy nie rzuca
export function callProc(uri, input = {}, { timeout = 60000, env = process.env } = {}) {
  const bin = uriToPath(uri);
  if (!bin || !existsSync(bin)) return { ok: false, error: `Proces nie istnieje: ${uri}` };
  const r = spawnSync('node', [bin], { input: JSON.stringify(input), encoding: 'utf8', timeout, env });
  if (r.error) return { ok: false, error: r.error.message, exit: r.status };
  try {
    const out = JSON.parse(r.stdout.trim());
    return r.status === 0 ? out : { ok: false, exit: r.status, ...out };
  } catch {
    return { ok: false, exit: r.status, error: r.stderr?.trim() || 'Niepoprawny JSON na wyjściu procesu', raw: r.stdout };
  }
}
