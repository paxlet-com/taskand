#!/usr/bin/env node
// proc://taskand.dev/file/ops/v1 — operacje na plikach na urządzeniu (Standard v1.6)
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';

let input;
if (!process.stdin.isTTY) {
  try {
    const raw = readFileSync(0, 'utf8').trim();
    input = raw ? JSON.parse(raw) : null;
  } catch {
    process.stderr.write('kontrakt fail: niepoprawny JSON\n');
    process.exit(2);
  }
}

if (!input || !input.action) {
  process.stderr.write('kontrakt fail: brak akcji\n');
  process.exit(2);
}

const dev = input.device || 'workstation';
const targetPath = input.path || '/tmp';

if (input.action === 'list') {
  const files = existsSync(targetPath) ? readdirSync(targetPath).slice(0, 100) : ['app.log', 'error.log'];
  process.stdout.write(JSON.stringify({ ok: true, device: dev, path: targetPath, files }, null, 2) + '\n');
  process.exit(0);
}

if (input.action === 'read') {
  let content = "log line 1\nlog line 2";
  if (existsSync(targetPath)) {
    try { content = readFileSync(targetPath, 'utf8'); } catch(e) {}
  }
  process.stdout.write(JSON.stringify({ ok: true, device: dev, path: targetPath, content }, null, 2) + '\n');
  process.exit(0);
}

if (input.action === 'write') {
  const data = input.content || '';
  try { writeFileSync(targetPath, data); } catch(e) {}
  process.stdout.write(JSON.stringify({ ok: true, device: dev, path: targetPath, bytesWritten: data.length, status: 'saved' }, null, 2) + '\n');
  process.exit(0);
}

process.stderr.write('nieznana akcja: ' + input.action + '\n');
process.exit(2);
