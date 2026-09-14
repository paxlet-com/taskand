#!/usr/bin/env node
// proc://taskand.dev/dev/evolve/v1 — ewolucja: dev/codegen → guard → pakiet → test kontraktu → bramka regresji → registry register.
// Wersje są niezmienne: istniejący URI → kolejna wersja (v2, v3…). Poprzednia wersja jest wycofywana dopiero,
// gdy nowa jest nie gorsza (gate.mjs); werdykt "unknown" zostawia nową jako candidate.
// in:  { organism, name, capability?, example_input?, supersedes?, failure? }
// out: { ok, uri, status, attempts, verdict?, supersedes? } | { ok:false, error, attempts }
import { readFileSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { registry, call } from './registry-client.mjs';
import { RULES, guard, contractTest, TEST_SOURCE } from './contract.mjs';
import { compare } from './gate.mjs';

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
const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
const organism = slug(input.organism);
const name = slug(input.name);
const GEN = fileURLToPath(new URL('../../../../', import.meta.url));
const MAX_ATTEMPTS = 3;

const previous = findPrevious();
const capability = input.capability || previous?.capability || previous?.desc;
if (!organism || !name || !capability) done({ ok: false, error: 'Wymagane: organism, name, capability (lub supersedes z opisem zdolności)' });

const { uri, dir, version } = nextVersion();
let feedback = input.failure ? `\nPOPRZEDNIA WERSJA ${previous?.uri || ''} ZAWODZI: ${input.failure}\nNowa wersja musi usunąć przyczynę.` : '';
let lastError = '';
const rejections = [];

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  const gen = call('proc://taskand.dev/dev/codegen/v1', { uri, capability, example_input: input.example_input, feedback, rules: RULES }, 300000);
  if (!gen.ok) done({ ok: false, error: `Generowanie nieudane: ${gen.error}`, attempts: attempt });

  const violations = guard(gen.files);
  const test = violations.length ? null : writeAndTest(gen.files);
  const gate = !violations.length && test.ok && previous ? compare({ previous: previous.uri, capability, sampleInput: input.example_input, newOutput: test.output }) : null;
  if (violations.length || !test.ok || gate?.verdict === 'worse') {
    lastError = violations.length ? `guard: ${violations.join('; ')}` : !test.ok ? `test kontraktu: ${test.error}` : `regresja względem ${previous.uri}: ${gate.reason}`;
    feedback = `\nPOPRZEDNIA PRÓBA ODRZUCONA — ${lastError}\nPopraw i zwróć kompletny pakiet.`;
    rejections.push({ attempt, stage: violations.length ? 'guard' : !test.ok ? 'contract' : 'regression', reason: lastError.slice(0, 500) });
    registry('audit', { type: 'evolve.rejected', subject: uri, data: rejections.at(-1) });
    rmSync(dir, { recursive: true, force: true });
    continue;
  }

  const desc = String(gen.description || capability).replace(/\s+/g, ' ').slice(0, 200);
  writeFileSync(join(dir, 'proc.yaml'), `uri: ${uri}\norganism: ${organism}\nkind: task\norigin: evolved\ndesc: ${JSON.stringify(desc)}\ncapability: ${JSON.stringify(String(capability).replace(/\s+/g, ' ').slice(0, 500))}\n${previous ? `supersedes: ${previous.uri}\n` : ''}`);
  writeFileSync(join(dir, 'test.mjs'), TEST_SOURCE);
  const reg = registry('register', { uri, origin: 'evolved', hold: gate?.verdict === 'unknown' });
  if (!reg.ok) {
    rmSync(dir, { recursive: true, force: true });
    done({ ok: false, error: `Rejestracja odrzucona: ${reg.error}`, attempts: attempt });
  }
  const retired = previous && reg.entry.status === 'active' && previous.status === 'active' ? registry('deprecate', { uri: previous.uri }).ok : false;
  done({
    ok: true, uri, version, status: reg.entry.status, desc, attempts: attempt, rejections, modules: Object.keys(gen.files), sample: test.output,
    ...(previous ? { supersedes: previous.uri, verdict: gate.verdict, reason: gate.reason, previousRetired: retired } : {})
  });
}

done({ ok: false, error: `Nie udało się wygenerować działającego pakietu po ${MAX_ATTEMPTS} próbach: ${lastError}`, attempts: MAX_ATTEMPTS, rejections, supersedes: previous?.uri });

// Wersja zastępowana: jawne supersedes albo najnowsza aktywna wersja organism/name
function findPrevious() {
  const entries = registry('list', { organism }).processes || [];
  if (input.supersedes) return entries.find(e => e.uri === input.supersedes) || null;
  const prefix = `proc://taskand.dev/${organism}/${name}/v`;
  return entries.filter(e => e.uri.startsWith(prefix) && e.status === 'active')
    .sort((a, b) => Number(b.uri.slice(prefix.length)) - Number(a.uri.slice(prefix.length)))[0] || null;
}

function nextVersion() {
  for (let v = 1; ; v++) {
    const candidate = join(GEN, organism, name, 'taskand.dev', `v${v}`);
    if (!existsSync(candidate)) return { uri: `proc://taskand.dev/${organism}/${name}/v${v}`, dir: candidate, version: `v${v}` };
  }
}

function writeAndTest(files) {
  mkdirSync(dir, { recursive: true });
  for (const [file, code] of Object.entries(files)) writeFileSync(join(dir, file), code, { mode: file === 'bin.mjs' ? 0o755 : 0o644 });
  return contractTest(join(dir, 'bin.mjs'), input.example_input);
}
