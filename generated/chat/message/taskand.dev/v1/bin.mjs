#!/usr/bin/env node
import { readFileSync } from 'node:fs';
let i = {};
try {
  const raw = readFileSync(0, 'utf8').trim();
  if (raw) i = JSON.parse(raw);
} catch {
  process.exit(2);
}
const msg = i.message || '';
let reply;
if (msg.includes('stwórz') || msg.includes('stworz')) {
  reply = '[chat -> developer] Zlecam utworzenie procesu: ' + msg;
} else if (msg.includes('sprawdź') || msg.includes('sprawdz') || msg.includes('działa')) {
  reply = '[chat -> doctor] Zlecam diagnostykę systemu: ' + msg;
} else if (msg.includes('przeglądark') || msg.includes('otwórz') || msg.includes('screenshot')) {
  reply = '[chat -> browser] Zlecam sterowanie sesją noVNC: ' + msg;
} else if (msg.includes('klucz') || msg.includes('token') || msg.includes('sejf')) {
  reply = '[chat -> vault] Zlecam zarządzanie poświadczeniami: ' + msg;
} else {
  reply = `[chat] Przyjąłem wiadomość: "${msg}". Jestem organizmem konwersacyjnym taskand v2.0.`;
}
process.stdout.write(JSON.stringify({ ok: true, reply, ts: new Date().toISOString() }) + '\n');
process.exit(0);
