#!/usr/bin/env node
// proc://taskand.dev/chat/message/v1 — publiczny punkt wiadomości (rola guest): tylko potwierdza przyjęcie.
// Nie deleguje zadań — wykonanie wymaga organizmu dev (/api/chat z uprawnieniem do dev/chat).
import { readFileSync } from 'node:fs';

let input;
try {
  const raw = readFileSync(0, 'utf8').trim();
  input = raw ? JSON.parse(raw) : {};
} catch {
  process.exit(2);
}
const message = String(input.message || '').slice(0, 2000);
process.stdout.write(JSON.stringify({
  ok: true,
  received: message.length,
  reply: message
    ? '[chat] Wiadomość przyjęta. Ten punkt nie wykonuje zadań — użyj organizmu dev z tokenem, który ma do niego grant.'
    : '[chat] Pusta wiadomość.',
  ts: new Date().toISOString()
}) + '\n');
process.exit(0);
