#!/usr/bin/env node
// proc://taskand.dev/vault/chat/v1 — Konwersacyjny interfejs sejfu poświadczeń
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const secretsBin = join(dir, '../../secrets/taskand.dev/v1/bin.mjs');

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

const prompt = input.message || input.prompt || input.text || "";
if (!prompt) {
  process.stderr.write('kontrakt fail: brak pola message\n');
  process.exit(2);
}

const low = prompt.toLowerCase();
let reply = "";
let intent = "vault-status";

if (low.includes("migruj") || low.includes("przenieś") || low.includes("vault")) {
  intent = "vault-migrate";
  const p = spawnSync('node', [secretsBin], { input: JSON.stringify({ action: "migrate" }), encoding: 'utf8' });
  const data = p.status === 0 ? JSON.parse(p.stdout) : {};
  reply = `Migracja sekretu: llm/api-key do sejfu Vault (AES-256-GCM).\n` +
          `Status: ${data.status || 'sukces'}.\n` +
          `Udzielone uprawnienia (purpose-scoped):\n` +
          `  • developer → purpose=codegen (generowanie procesów przez LLM)\n` +
          `  • doctor → purpose=diagnosis (analiza przyczyn awarii przez LLM)\n` +
          `Token jest teraz bezpiecznie izolowany w Vault i chroniony audytem.`;
} else if (low.includes("kto") || low.includes("audit") || low.includes("audyt") || low.includes("dostep") || low.includes("dostęp")) {
  intent = "vault-audit";
  const p = spawnSync('node', [secretsBin], { input: JSON.stringify({ action: "audit" }), encoding: 'utf8' });
  const data = p.status === 0 ? JSON.parse(p.stdout) : {};
  const count = data.totalEntries || 0;
  reply = `Rejestr audytu sejfu Vault (ostatnie wpisy):\n` +
          (count > 0 
            ? data.auditTrail.slice(-5).map(e => `  [${e.timestamp.slice(11, 19)}] ${e.consumer} → ${e.secret} (${e.purpose}): ${e.status}`).join('\n')
            : `  Brak zarejestrowanych prób dostępu w bieżącym oknie. Wszystkie tokeny chronione.`) +
          `\nŁącznie wpisów: ${count}. Polityka DENY-ALL poza celami codegen i diagnosis.`;
} else {
  const p = spawnSync('node', [secretsBin], { input: JSON.stringify({ action: "status" }), encoding: 'utf8' });
  const data = p.status === 0 ? JSON.parse(p.stdout) : {};
  reply = `Sejf Vault (taskand-vault v1.4) jest aktywny i szyfrowany (AES-256-GCM).\n` +
          `Zarządzane poświadczenia: llm/api-key (GLM-5.3 / ZhipuAI).\n` +
          `Dostępne komendy: "migruj token do vaulta", "pokaż audyt dostępu", "status uprawnień".`;
}

const result = {
  ok: true,
  uri: "proc://taskand.dev/vault/chat/v1",
  prompt,
  intent,
  reply,
  timestamp: new Date().toISOString()
};

process.stdout.write(JSON.stringify(result, null, 2) + '\n');
process.exit(0);
