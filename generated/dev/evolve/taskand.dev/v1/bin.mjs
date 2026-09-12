#!/usr/bin/env node
// proc://taskand.dev/dev/evolve/v1 — ewolucja: LLM generuje nowy proces → guard → test kontraktu → rejestracja
// in:  { organism, name, capability, example_input? }
// out: { ok, uri, path, attempts } | { ok:false, error, attempts }
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { readInput, emit, callProc, uriToPath, adoptOwnership } from '../../../../_lib/proc.mjs';
import { register } from '../../../../_lib/catalog.mjs';
import { SYSTEM, guard, contractTest } from './contract.mjs';

const input = readInput();
const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
const organism = slug(input.organism);
const name = slug(input.name);

if (!organism || !name || !input.capability) {
  emit({ ok: false, error: 'Wymagane: organism, name, capability', usage: '{"organism":"admin","name":"lan-scan","capability":"..."}' });
}

const uri = `proc://taskand.dev/${organism}/${name}/v1`;
const bin = uriToPath(uri);
const dir = dirname(bin);
if (existsSync(bin)) emit({ ok: false, error: `Proces już istnieje: ${uri}`, uri });

const MAX_ATTEMPTS = 3;
let feedback = '';
let lastError = '';

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  const gen = callProc('proc://taskand.dev/dev/llm/v1', {
    system: SYSTEM,
    prompt: `URI: ${uri}\nZdolność do zaimplementowania: ${input.capability}\n` +
      (input.example_input ? `Przykładowe wejście: ${JSON.stringify(input.example_input)}\n` : '') +
      feedback,
    json: true,
    max_tokens: 12000,
    temperature: 0.1
  }, { timeout: 120000 });

  if (!gen.ok) emit({ ok: false, error: `Generowanie nieudane: ${gen.error}`, attempts: attempt });
  const { code, description } = gen.json;
  const violation = typeof code === 'string' ? guard(code) : 'brak pola "code"';
  if (violation) {
    lastError = `odrzucony przez guard: ${violation}`;
    feedback = `\nPOPRZEDNIA PRÓBA ODRZUCONA (${lastError}). Popraw kod.`;
    continue;
  }

  mkdirSync(dir, { recursive: true });
  writeFileSync(bin, code, { mode: 0o755 });
  const test = contractTest(bin, input.example_input);
  if (!test.ok) {
    rmSync(dir, { recursive: true, force: true });
    lastError = test.error;
    feedback = `\nPOPRZEDNIA PRÓBA NIE PRZESZŁA TESTU KONTRAKTU: ${test.error}\nPopraw kod.`;
    continue;
  }

  const desc = String(description || input.capability).slice(0, 200);
  writeFileSync(`${dir}/proc.yaml`, `proc:\n  uri: ${uri}\n  kind: task\n  organism: ${organism}\n  origin: evolved\n  description: ${JSON.stringify(desc)}\n`);
  writeFileSync(`${dir}/test.mjs`, contractTestSource());
  register({ uri, desc, organism, origin: 'evolved' });
  adoptOwnership(dir);
  emit({ ok: true, uri, path: bin, desc, attempts: attempt, sample: test.output });
}

emit({ ok: false, error: `Nie udało się wygenerować działającego procesu po ${MAX_ATTEMPTS} próbach: ${lastError}`, attempts: MAX_ATTEMPTS });

function contractTestSource() {
  return `import { spawnSync } from 'node:child_process';
const r = spawnSync('node', [new URL('./bin.mjs', import.meta.url).pathname], { input: '{}', encoding: 'utf8', timeout: 20000 });
const out = JSON.parse(r.stdout);
if (r.status !== 0 || typeof out.ok !== 'boolean') process.exit(1);
console.log('✓ PASS');
`;
}
