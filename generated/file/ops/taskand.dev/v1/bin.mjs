#!/usr/bin/env node
// proc://taskand.dev/file/ops/v1 — operacje tylko do odczytu na systemie plików węzła wykonującego proces
// in: { op: list|stat|read|exists, path?, max_bytes? }
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { homedir, hostname } from 'node:os';
import { resolve } from 'node:path';

let input;
try {
  const raw = readFileSync(0, 'utf8').trim();
  input = raw ? JSON.parse(raw) : {};
} catch {
  process.exit(2);
}

const MAX_READ = 1024 * 1024;
const op = input.op || 'list';
const path = resolve(input.path || homedir());
// Gateway działa w kontenerze: widzi system plików kontenera, nie hosta
const scope = existsSync('/taskand/generated') ? 'kontener gateway' : 'host';
const emit = out => {
  process.stdout.write(JSON.stringify({ op, path, device: hostname(), scope, ...out, ts: new Date().toISOString() }) + '\n');
  process.exit(0);
};

const OPS = {
  exists: () => ({ ok: true, exists: existsSync(path) }),
  stat: () => {
    const st = statSync(path);
    return { ok: true, exists: true, type: st.isDirectory() ? 'dir' : 'file', size: st.size, mtime: st.mtime.toISOString(), mode: (st.mode & 0o777).toString(8) };
  },
  list: () => {
    const entries = readdirSync(path, { withFileTypes: true }).map(d => ({ name: d.name, type: d.isDirectory() ? 'dir' : d.isFile() ? 'file' : 'other' }));
    return { ok: true, entries, summary: `${entries.length} pozycji w ${path} (${scope})` };
  },
  read: () => {
    const limit = Math.min(Number(input.max_bytes) || 65536, MAX_READ);
    const st = statSync(path);
    if (!st.isFile()) return { ok: false, error: `${path} nie jest plikiem` };
    const buf = readFileSync(path).subarray(0, limit);
    return { ok: true, size: st.size, truncated: st.size > limit, content: buf.toString('utf8') };
  }
};

if (!OPS[op]) emit({ ok: false, error: `Nieznana operacja "${op}" (dozwolone: ${Object.keys(OPS).join(', ')})` });
try {
  emit(OPS[op]());
} catch (err) {
  emit({ ok: false, error: `${err.code || 'ERROR'}: ${err.message}` });
}
