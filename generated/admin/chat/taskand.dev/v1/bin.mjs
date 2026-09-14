#!/usr/bin/env node
// proc://taskand.dev/admin/chat/v1 — organizm admin: każde zadanie → dev/act (wybór procesu z rejestru lub ewolucja)
import { readFileSync } from 'node:fs';
import { call } from './registry-client.mjs';

let input;
try {
  const raw = readFileSync(0, 'utf8').trim();
  input = raw ? JSON.parse(raw) : {};
} catch {
  process.exit(2);
}
const message = input.message || input.prompt || '';
const r = message
  ? call('proc://taskand.dev/dev/act/v1', { organism: 'admin', message }, 900000)
  : { ok: true, reply: '[admin] Gotowy. Podaj zadanie.' };
process.stdout.write(JSON.stringify({ ok: r.ok !== false, organism: 'admin', reply: r.reply || r.error, action: r.action, uri: r.uri }) + '\n');
process.exit(0);
