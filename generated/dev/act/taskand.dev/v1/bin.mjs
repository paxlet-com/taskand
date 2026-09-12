#!/usr/bin/env node
// proc://taskand.dev/dev/act/v1 — pojedyncze zadanie usera: wybierz proces z katalogu LUB wyewoluuj nowy → wykonaj
// in:  { message, organism?, forceEvolve?: bool }
// out: { ok, reply, action, uri?, evolved?, result? }
import { readInput, emit, callProc } from '../../../../_lib/proc.mjs';
import { resolveUri } from '../../../../_lib/catalog.mjs';
import { capabilityContext } from '../../../llm/taskand.dev/v1/context.mjs';

const input = readInput();
const message = String(input.message || input.prompt || '').trim();
const organism = String(input.organism || 'dev').toLowerCase();
const tag = `[${organism}]`;
if (!message) emit({ ok: true, reply: `${tag} Podaj zadanie w polu "message".`, action: 'noop' });

const LLM = 'proc://taskand.dev/dev/llm/v1';
const SAFE_ENV = { PATH: process.env.PATH, HOME: process.env.HOME || '/tmp', LANG: 'C.UTF-8' };

const decision = decide();
const handlers = { answer, call: () => run(decision.uri, decision), evolve };
emit(await (handlers[decision.action] || invalid)());

function decide() {
  const r = callProc(LLM, {
    system: `Jesteś organizmem "${organism}" systemu taskand. System WYKONUJE zadania na węźle — nie odsyłaj usera do narzędzi.
Dostępne procesy (proc://):
${capabilityContext({ organism })}

Wybierz JEDNĄ akcję i zwróć WYŁĄCZNIE JSON:
- {"action":"call","uri":"<URI z listy>","input":{...}} — gdy istniejący proces realnie spełnia zadanie
- {"action":"evolve","name":"<kebab-case>","capability":"<precyzyjny opis zdolności do zaimplementowania>","input":{...}} — gdy zadanie wymaga danych/akcji z węzła, a żaden proces tego nie robi
- {"action":"answer","text":"..."} — WYŁĄCZNIE dla rozmowy/wiedzy ogólnej, która nie wymaga danych z węzła
${input.forceEvolve ? 'User jawnie prosi o NOWY proces: wybierz "evolve".' : ''}`,
    prompt: message,
    json: true,
    max_tokens: 800,
    temperature: 0
  });
  if (!r.ok) return { action: 'unavailable', error: r.error };
  return r.json;
}

function answer() {
  return { ok: true, action: 'answer', reply: decision.text || `${tag} (brak odpowiedzi)` };
}

async function run(uri, { input: procInput = {} } = {}, evolved = null) {
  const resolved = resolveUri(uri);
  if (!resolved.ok) return { ok: false, action: 'call', uri, reply: `${tag} ✗ ${resolved.error}` };
  const result = callProc(uri, procInput, { timeout: 30000, env: SAFE_ENV });
  return { ok: result.ok !== false, action: evolved ? 'evolve' : 'call', uri, evolved, result, reply: format(uri, result, evolved) };
}

async function evolve() {
  const ev = callProc('proc://taskand.dev/dev/evolve/v1', {
    organism,
    name: decision.name,
    capability: decision.capability || message,
    example_input: decision.input && Object.keys(decision.input).length ? decision.input : undefined
  }, { timeout: 480000 });
  if (!ev.ok && !String(ev.error).startsWith('Proces już istnieje')) {
    return { ok: false, action: 'evolve', reply: `${tag} ✗ Nie wyewoluowałem procesu: ${ev.error}` };
  }
  return run(ev.uri, decision, ev.ok ? ev : null);
}

function invalid() {
  const why = decision.action === 'unavailable' ? decision.error : `nieznana akcja LLM: ${JSON.stringify(decision)}`;
  return { ok: false, action: 'none', reply: `${tag} ✗ Nie mogę zaplanować akcji (${why}). Zadanie nie zostało wykonane.` };
}

function format(uri, result, evolved) {
  const head = evolved
    ? `${tag} ⚙ Brakowało zdolności — wyewoluowałem proces ${uri} (próby: ${evolved.attempts}, test kontraktu: PASS)\n`
    : '';
  if (result.ok === false) return `${head}${tag} ✗ ${uri}: ${result.error || 'błąd procesu'}`;
  const summary = result.summary || result.reply || result.message;
  const data = JSON.stringify(result, null, 2);
  return `${head}${tag} ${summary || '✓ wykonano'}\n${summary ? '' : data}`.trimEnd();
}
