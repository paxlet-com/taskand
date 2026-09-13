#!/usr/bin/env node
// proc://taskand.dev/dev/codegen/v1 — generowanie kodu pakietu przez LLM (bez zapisu na dysk)
// in:  { uri, capability, example_input?, feedback?, rules }
// out: { ok, description, files: { "bin.mjs": "...", "<moduł>.mjs": "..." } }
import { readFileSync } from 'node:fs';
import { call } from './registry-client.mjs';

let input;
try {
  const raw = readFileSync(0, 'utf8').trim();
  input = raw ? JSON.parse(raw) : {};
} catch {
  process.exit(2);
}

const done = out => {
  process.stdout.write(JSON.stringify(out) + '\n');
  process.exit(0);
};
if (!input.uri || !input.capability || !input.rules) done({ ok: false, error: 'Wymagane: uri, capability, rules' });

const r = call('proc://taskand.dev/dev/llm/v1', {
  system: input.rules,
  prompt: `URI: ${input.uri}\nZdolność do zaimplementowania: ${input.capability}\n` +
    (input.example_input ? `Przykładowe wejście: ${JSON.stringify(input.example_input)}\n` : '') +
    (input.feedback || ''),
  json: true,
  max_tokens: 16000,
  temperature: 0.1
}, 300000);

if (!r.ok) done({ ok: false, error: `LLM: ${r.error}` });
const { description, files, code } = r.json;
// Zgodność wstecz: pojedyncze pole "code" = bin.mjs
const normalized = files && typeof files === 'object' ? files : code ? { 'bin.mjs': code } : null;
if (!normalized?.['bin.mjs']) done({ ok: false, error: 'LLM nie zwrócił files["bin.mjs"]' });
done({ ok: true, description, files: normalized });
