#!/usr/bin/env node
// proc://taskand.dev/chat/message/v1 — Obsługa konwersacji i pamięci LLM
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

const message = input.message || input.text || input.prompt;
if (!message) {
  process.stderr.write('kontrakt fail: brak wymaganego pola message w wejściu\n');
  process.exit(2);
}

const reply = {
  ok: true,
  uri: "proc://taskand.dev/chat/message/v1",
  conversationId: input.conversationId || "conv-default",
  message,
  reply: `Przyjęto komunikat: "${message}". Kontekst środowiska załadowany zgodnie z wellmanifest/llm & wellmanifest/logs@v1.`,
  intent: message.includes("wypchnij") ? "git-push" : (message.includes("twin") ? "twin-test" : "general-query"),
  timestamp: new Date().toISOString()
};

process.stdout.write(JSON.stringify(reply, null, 2) + '\n');
process.exit(0);
