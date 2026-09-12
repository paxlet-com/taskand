#!/usr/bin/env node
// proc://taskand.dev/chat/voice/v1 — Tłumacz komend głosowych Web Speech API
import { readFileSync } from 'node:fs';

let input;
if (!process.stdin.isTTY) {
  try {
    const raw = readFileSync(0, 'utf8').trim();
    input = raw ? JSON.parse(raw) : {};
  } catch (e) {
    process.stderr.write('kontrakt fail: niepoprawny JSON na wejściu\n');
    process.exit(2);
  }
} else {
  input = {};
}

const transcript = input.transcript || input.spoken;
if (!transcript) {
  process.stderr.write('kontrakt fail: brak wymaganego pola transcript w wejściu\n');
  process.exit(2);
}

const normalized = transcript.trim().toLowerCase();
let action = "submit-task";
let voiceFeedback = `Wykonywanie polecenia: ${transcript}`;

if (normalized.includes("logi")) {
  action = "fetch-logs";
  voiceFeedback = "Pokazuję logi kontrolera";
} else if (normalized.includes("zadania") || normalized.includes("status")) {
  action = "fetch-tasks";
  voiceFeedback = "Odświeżam listę zadań";
} else if (normalized.includes("twin") || normalized.includes("bliźniak")) {
  action = "run-twin";
  voiceFeedback = "Uruchamiam kwalifikację w cyfrowym bliźniaku";
} else if (normalized.includes("cofnij") || normalized.includes("rollback")) {
  action = "rollback";
  voiceFeedback = "Przywracam poprzednią migawkę";
}

const result = {
  ok: true,
  uri: "proc://taskand.dev/chat/voice/v1",
  transcript,
  action,
  voiceFeedback,
  lang: "pl-PL"
};

process.stdout.write(JSON.stringify(result, null, 2) + '\n');
process.exit(0);
