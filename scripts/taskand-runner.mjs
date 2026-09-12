#!/usr/bin/env node
/**
 * taskand v1.0 — Uniwersalny Launcher Procesów URI (proc://...)
 * Zapewnia: URI -> binding -> runtime -> JSON stdin -> JSON stdout
 */
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const uri = process.argv[2];
if (!uri) {
  process.stderr.write('Użycie: printf \'%s\' \'$JSON\' | node scripts/taskand-runner.mjs <proc://...>\n');
  process.exit(2);
}

// Rozwiązanie URI
const m = uri.match(/^proc:\/\/([^/]+)\/(.+)\/(v\d+)$/);
if (!m) {
  process.stderr.write(`Błąd: '${uri}' nie jest poprawnym URI procesu (oczekiwano proc://<org>/<ścieżka>/<wersja>)\n`);
  process.exit(2);
}

const org = m[1];
const ability = m[2];
const ver = m[3];
const procDir = join(process.cwd(), 'proc', ability, org, ver);
const binPath = join(procDir, 'bin.mjs');

if (!existsSync(binPath)) {
  process.stderr.write(`Błąd: proces ${uri} nie został odnaleziony w katalogu ${procDir}\n`);
  process.exit(2);
}

// Przekazanie stdin do procesu potomnego
let inputBuffer = Buffer.alloc(0);
try {
  inputBuffer = readFileSync(0);
} catch (e) {
  inputBuffer = Buffer.from('{}');
}

const child = spawnSync('node', [binPath], {
  input: inputBuffer,
  stdio: ['pipe', 'inherit', 'inherit']
});

process.exit(child.status ?? 1);
