#!/usr/bin/env node
// proc://taskand.dev/dev/chat/v1 — jedyne wejście konwersacyjne: {message, organism?} → intencja → proces przez rejestr
import { readFileSync } from 'node:fs';
import { parseIntent } from './intent.mjs';
import { dispatch } from './dispatch.mjs';

let input;
try {
  const raw = readFileSync(0, 'utf8').trim();
  input = raw ? JSON.parse(raw) : {};
} catch {
  process.exit(2);
}

const intent = parseIntent(input.message || input.prompt || 'status', input.organism || '');
let out;
try {
  out = { ok: true, organism: intent.organism, intent: intent.name, reply: dispatch(intent) };
} catch (err) {
  out = { ok: false, organism: intent.organism, intent: intent.name, reply: `[${intent.organism}] ✗ ${err.message}` };
}
process.stdout.write(JSON.stringify(out) + '\n');
process.exit(0);
