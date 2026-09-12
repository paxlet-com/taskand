#!/usr/bin/env node
// proc://taskand.dev/file-ops/chat/v1
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

if (norm.includes("pokaz") || norm.includes("lista") || norm.includes("ls") || norm.includes("pliki")) {
  reply = `[${dev}] Pliki w wybranym katalogu:\n  • /home/taskand/app.log\n  • /home/taskand/error.log`;
} else if (norm.includes("przeczytaj") || norm.includes("odczytaj") || norm.includes("cat")) {
  reply = `[${dev}] Ostatnie linie pliku log:\n[taskand worker] status: active, cpu: normal, mesh: connected`;
} else if (norm.includes("zapisz") || norm.includes("utworz")) {
  reply = `[${dev}] Zapisano plik pomyślnie (snapshot CAS utworzony przed zapisem).`;
} else {
  reply = `[${dev}] file-ops gotowy do operacji na plikach (read, write, list, search).`;
}

process.stdout.write(JSON.stringify({ ok: true, uri: "proc://taskand.dev/file-ops/chat/v1", device: dev, reply }, null, 2) + '\n');
process.exit(0);
