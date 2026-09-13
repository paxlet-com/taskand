#!/usr/bin/env node
// proc://taskand.dev/dev/composite/v1 — zadanie złożone: planner → validator → (evolve brakujących) → orchestrator
// in:  { task, organism? }
// out: { ok, status, reply, runId? }
import { readFileSync } from 'node:fs';
import { call } from './registry-client.mjs';

let input;
try {
  const raw = readFileSync(0, 'utf8').trim();
  input = raw ? JSON.parse(raw) : {};
} catch {
  process.exit(2);
}

const task = String(input.task || input.message || '').trim();
const organism = input.organism || 'worker';
const lines = [];
const say = s => lines.push(s);
const done = (ok, status, extra = {}) => {
  process.stdout.write(JSON.stringify({ ok, status, reply: lines.join('\n'), ...extra }) + '\n');
  process.exit(0);
};
if (!task) {
  say('[composite] Podaj złożone zadanie w polu "task".');
  done(true, 'READY');
}

// KROK 1: PLANNER
const plan = call('proc://taskand.dev/planner/plan/v1', { task }, 180000);
if (!plan.valid || !plan.blueprint) {
  say(`[planner] Stan: ${plan.status || 'PLANNING_UNAVAILABLE'}`);
  say(`Cel zachowany: "${plan.goal || task}"`);
  say(`Powód: ${plan.reason || plan.error || 'Nie można wygenerować planu.'}`);
  done(false, plan.status || 'PLANNING_UNAVAILABLE');
}
say(`[planner] Rozłożyłem zadanie na ${plan.blueprint.steps.length} kroków:`);
for (const s of plan.blueprint.steps) {
  const deps = s.deps?.length ? ` [deps: ${s.deps.join(', ')}]` : '';
  say(`  ${s.id}. ${s.name} — ${s.description} (${s.process})${deps}`);
}

// KROK 2: WALIDATOR (+ ewolucja brakujących zdolności jako osobne zadania, potem ponowna walidacja)
let val = validate(plan.blueprint);
if (val.status === 'NEEDS_EVOLUTION') {
  for (const cap of val.unresolvedCapabilities) evolveStep(cap);
  val = validate(plan.blueprint);
}
if (val.status !== 'APPROVED') done(false, val.status || 'REJECTED');
say(`[validator] ✓ Graf, ID, cykle, sekrety (vault://) i rejestr (status + bindingHash) — ${val.status}`);

// KROK 3: ORKIESTRATOR
const orch = call('proc://taskand.dev/orchestrator/execute/v1', { approvedPlan: val.approvedPlan }, 600000);
if (!orch.runId) {
  say(`[orchestrator] ✗ Błąd wykonania: ${orch.error}`);
  done(false, 'FAILED');
}
say(`\n[orchestrator] Run: ${orch.runId}`);
for (const [name, s] of Object.entries(orch.steps || {})) say(stepLine(name, s));
say(`\nStan końcowy: ${orch.status} (${orch.succeeded}/${orch.totalSteps} kroków)`);
say(`Trwały stan: ${orch.stateFile}`);
done(orch.status === 'SUCCEEDED', orch.status, { runId: orch.runId });

function validate(blueprint) {
  const r = call('proc://taskand.dev/validator/resolve/v1', { blueprint }, 60000);
  if (r.status !== 'APPROVED' && r.status !== 'NEEDS_EVOLUTION') {
    say('[validator] ✗ Odrzucono plan:');
    (r.errors || [r.error]).forEach(e => say(`  - ${e}`));
  }
  return r;
}

function evolveStep(cap) {
  const step = plan.blueprint.steps.find(s => s.id === cap.stepId);
  const ev = call('proc://taskand.dev/dev/evolve/v1', {
    organism,
    name: cap.requestedProcess.replace('spawn:', ''),
    capability: cap.description,
    example_input: { params: step.params || {}, dependencies: {} }
  }, 900000);
  if (!ev.ok) {
    say(`[evolve] ✗ ${cap.name}: ${ev.error}`);
    done(false, 'EVOLUTION_FAILED');
  }
  if (ev.status !== 'active') {
    say(`[evolve] ⏸ ${cap.name} → ${ev.uri} czeka na zatwierdzenie (taskand approve ${ev.uri})`);
    done(false, 'AWAITING_APPROVAL');
  }
  say(`[evolve] ✓ ${cap.name} → ${ev.uri} (próby: ${ev.attempts})`);
  step.process = ev.uri;
}

function stepLine(name, s) {
  if (s.status === 'SUCCEEDED') {
    const o = s.output || {};
    const detail = o.summary || o.message || (o.cpu_pct !== undefined ? `CPU = ${o.cpu_pct}%` : o.port ? `:${o.port}` : '');
    return `  ✓ ${s.id} [${name}] SUCCEEDED${detail ? `: ${detail}` : ''}`;
  }
  if (s.status === 'BLOCKED') return `  ⚠ ${s.id} [${name}] BLOCKED: ${s.reason}`;
  return `  ✗ ${s.id} [${name}] FAILED (${s.errorType || 'ERROR'}): ${s.error}`;
}
