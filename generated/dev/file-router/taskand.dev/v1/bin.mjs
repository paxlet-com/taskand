#!/usr/bin/env node
// proc://taskand.dev/dev/file-router/v1 — pytania o pliki z promptu → odpowiedź o istnieniu/rozmiarze
// in: { path? , message? }  out: { ok, path, exists, size?, reply }
import { readFileSync, statSync } from 'node:fs';

let input;
try {
  const raw = readFileSync(0, 'utf8').trim();
  input = raw ? JSON.parse(raw) : {};
} catch {
  process.exit(2);
}
const emit = out => {
  process.stdout.write(JSON.stringify(out) + '\n');
  process.exit(0);
};
const path = input.path || String(input.message || '').match(/(\/[\w.-]+)+/)?.[0];
if (!path) emit({ ok: true, exists: null, reply: '[file-ops] Podaj ścieżkę pliku (np. /etc/hostname).' });

try {
  const st = statSync(path);
  const kind = st.isDirectory() ? 'katalog' : 'plik';
  emit({ ok: true, path, exists: true, size: st.size, reply: `[file-ops] ✓ ISTNIEJE ${kind} ${path} (${st.size} B)` });
} catch {
  emit({ ok: true, path, exists: false, reply: `[file-ops] ✗ Plik ${path} NIE istnieje w środowisku węzła.` });
}
