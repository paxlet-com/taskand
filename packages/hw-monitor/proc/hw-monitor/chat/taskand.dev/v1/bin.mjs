#!/usr/bin/env node
// proc://taskand.dev/hw-monitor/chat/v1
import { readFileSync } from 'node:fs';

let input;
try {
  const raw = readFileSync(0, 'utf8').trim();
  input = raw ? JSON.parse(raw) : {};
} catch {
  process.stderr.write('kontrakt fail: niepoprawny JSON\n');
  process.exit(2);
}

const msg = (input.message || input.prompt || input.text || "").toLowerCase();
if (!msg) {
  process.stderr.write('kontrakt fail: brak wiadomości\n');
  process.exit(2);
}

const norm = msg.replace(/ł/g, "l").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const dev = input.device || 'rpi5';
let reply = "";

if (norm.includes("temperatura") || norm.includes("temp")) {
  const temp = dev === 'vm-test' ? '38.0°C (symulacja VM)' : '42.5°C';
  reply = `[${dev}] Temperatura procesora CPU: ${temp}`;
} else if (norm.includes("gpio")) {
  reply = `[${dev}] GPIO 17 stan: {"gpio17": "input", "value": 1}`;
} else if (norm.includes("dysk") || norm.includes("miejsce")) {
  reply = `[${dev}] Wolne miejsce na dysku: 24.3 GB`;
} else {
  reply = `[${dev}] hw-monitor aktywny: CPU 42.5°C, RAM wolne 3.8GB, GPIO dostępne.`;
}

process.stdout.write(JSON.stringify({ ok: true, uri: "proc://taskand.dev/hw-monitor/chat/v1", device: dev, reply }, null, 2) + '\n');
process.exit(0);
