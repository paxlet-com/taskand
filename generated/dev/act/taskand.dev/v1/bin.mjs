#!/usr/bin/env node
// proc://taskand.dev/dev/act/v1 — pojedyncze zadanie: wybierz aktywny proces z rejestru LUB wyewoluuj nowy → wykonaj
// in:  { message, organism?, forceEvolve?: bool }
// out: { ok, reply, action, uri?, evolved?, result? }
import { readFileSync } from 'node:fs';
import { registry, call } from './registry-client.mjs';

let input;
try {
  const raw = readFileSync(0, 'utf8').trim();
  input = raw ? JSON.parse(raw) : {};
} catch {
  process.exit(2);
}

const message = String(input.message || input.prompt || '').trim();
const organism = String(input.organism || 'dev').toLowerCase();
const tag = `[${organism}]`;
const done = out => {
  process.stdout.write(JSON.stringify(out) + '\n');
  process.exit(0);
};
if (!message) done({ ok: true, action: 'noop', reply: `${tag} Podaj zadanie w polu "message".` });

// Procesy infrastruktury nie są akcjami dla usera
const INTERNAL = /\/(registry|dev|planner|validator|orchestrator)\//;

const decision = decide();
const handlers = { answer, call: () => run(decision.uri, decision.input), evolve };
done((handlers[decision.action] || invalid)());

function capabilityContext() {
  const own = `proc://taskand.dev/${organism}/`;
  const procs = (registry('list', { status: 'active' }).processes || []).filter(p => !INTERNAL.test(p.uri) || p.uri.startsWith(own));
  procs.sort((a, b) => Number(b.uri.startsWith(own)) - Number(a.uri.startsWith(own)));
  return procs.map(p => `- ${p.uri} — ${p.desc}`).join('\n');
}

function decide() {
  const r = call('proc://taskand.dev/dev/llm/v1', {
    system: `Jesteś organizmem "${organism}" systemu taskand. System WYKONUJE zadania na węźle — nie odsyłaj usera do narzędzi.
Aktywne procesy w rejestrze (proc://):
${capabilityContext()}

Wybierz JEDNĄ akcję i zwróć WYŁĄCZNIE JSON:
- {"action":"call","uri":"<URI z listy>","input":{...}} — gdy istniejący proces realnie spełnia zadanie
- {"action":"evolve","name":"<kebab-case>","capability":"<precyzyjny opis zdolności>","input":{...}} — gdy zadanie wymaga danych/akcji z węzła, a żaden proces tego nie robi
- {"action":"answer","text":"..."} — WYŁĄCZNIE rozmowa/wiedza ogólna, bez danych z węzła
${input.forceEvolve ? 'User jawnie prosi o NOWY proces: wybierz "evolve".' : ''}`,
    prompt: message,
    json: true,
    max_tokens: 800,
    temperature: 0
  }, 120000);
  return r.ok ? r.json : { action: 'unavailable', error: r.error };
}

function answer() {
  return { ok: true, action: 'answer', reply: decision.text || `${tag} (brak odpowiedzi)` };
}

function run(uri, procInput = {}, evolved = null) {
  const result = call(uri, procInput, 60000);
  return { ok: result.ok !== false, action: evolved ? 'evolve' : 'call', uri, evolved, result, reply: format(uri, result, evolved) };
}

function evolve() {
  const ev = call('proc://taskand.dev/dev/evolve/v1', {
    organism,
    name: decision.name,
    capability: decision.capability || message,
    example_input: decision.input && Object.keys(decision.input).length ? decision.input : undefined
  }, 900000);
  if (!ev.uri) return { ok: false, action: 'evolve', reply: `${tag} ✗ Nie wyewoluowałem procesu: ${ev.error}` };
  if (ev.status !== 'active') {
    return { ok: true, action: 'evolve', uri: ev.uri, reply: `${tag} ⚙ Wyewoluowałem ${ev.uri} — status "${ev.status}", czeka na zatwierdzenie: taskand approve ${ev.uri}` };
  }
  return run(ev.uri, decision.input, ev);
}

function invalid() {
  const why = decision.action === 'unavailable' ? decision.error : `nieznana akcja LLM: ${JSON.stringify(decision)}`;
  return { ok: false, action: 'none', reply: `${tag} ✗ Nie mogę zaplanować akcji (${why}). Zadanie nie zostało wykonane.` };
}

function format(uri, result, evolved) {
  const head = evolved ? `${tag} ⚙ Brakowało zdolności — wyewoluowałem ${uri} (próby: ${evolved.attempts}, test kontraktu: PASS)\n` : '';
  if (result.ok === false) return `${head}${tag} ✗ ${uri}: ${result.error || 'błąd procesu'}`;
  const summary = result.summary || result.reply || result.message;
  return `${head}${tag} ${summary || JSON.stringify(result, null, 2)}`;
}
