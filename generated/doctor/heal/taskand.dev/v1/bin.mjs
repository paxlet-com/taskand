#!/usr/bin/env node
// proc://taskand.dev/doctor/heal/v1 — pętla samonaprawy: diagnose → prescribe → wykonanie recept "organism" → ponowna diagnoza.
// in: { run?: true, max? }. Granice: policy.healing (auto|manual|off), max napraw na przebieg, odstęp między naprawami tego samego obiektu.
// Recepty "human" (Docker, sekrety, kod builtin) są tylko raportowane.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { registry, call } from './registry-client.mjs';

let input;
try {
  const raw = readFileSync(0, 'utf8').trim();
  input = raw ? JSON.parse(raw) : {};
} catch {
  process.exit(2);
}

const REGISTRY = 'proc://taskand.dev/registry/core/v1';
const EVENTS = fileURLToPath(new URL('../../../../../log/events.jsonl', import.meta.url));
const MAX_PER_RUN = Number(input.max) || 2;
const COOLDOWN_MS = 30 * 60 * 1000;
const EVOLVE_TIMEOUT_MS = 900000;

const policy = registry('policy', { name: 'healing' }).value || 'manual';
// Wykonanie wymaga jawnego {"run": true} i policy.healing=auto; samo {} (np. test kontraktu) tylko planuje
const mode = input.run === true && policy === 'auto' ? 'execute' : 'plan';
const before = call('proc://taskand.dev/doctor/diagnose/v1', {}, 90000);
const rx = call('proc://taskand.dev/doctor/prescribe/v1', { diagnosis: before }, 30000);
if (!rx.ok) done({ ok: false, error: `Brak recept: ${rx.error}` });

const forOrganisms = rx.prescriptions.filter(p => p.executor === 'organism');
const forHumans = rx.prescriptions.filter(p => p.executor === 'human');
const executed = [];
const skipped = [];

if (policy !== 'off' && mode === 'execute') {
  for (const p of forOrganisms) {
    if (executed.length >= MAX_PER_RUN) skipped.push({ subject: p.finding.subject, reason: `limit ${MAX_PER_RUN} napraw na przebieg` });
    else if (recentlyHealed(p.finding.subject)) skipped.push({ subject: p.finding.subject, reason: 'naprawiany w ciągu ostatnich 30 min' });
    else executed.push(heal(p));
  }
}

const after = executed.length ? call('proc://taskand.dev/doctor/diagnose/v1', {}, 90000) : before;
done({
  ok: executed.every(e => e.ok),
  policy,
  mode,
  healthyBefore: before.healthy,
  healthyAfter: after.healthy,
  executed,
  skipped,
  planned: mode === 'plan' ? forOrganisms.map(p => ({ subject: p.finding.subject, code: p.finding.code, remedies: p.remedies })) : [],
  human: forHumans.map(p => ({ code: p.finding.code, subject: p.finding.subject, action: p.action, why: p.why })),
  reply: report()
});

function heal(p) {
  const results = [];
  for (const r of p.remedies) {
    const out = r.uri === REGISTRY ? registry(r.input.action, r.input) : call(r.uri, r.input, EVOLVE_TIMEOUT_MS);
    const ok = out.ok !== false && !out.errorType;
    results.push({ uri: r.uri, action: r.input.action, ok, error: out.error, newUri: out.uri, verdict: out.verdict, status: out.status });
    if (!ok) break;
  }
  const ok = results.every(r => r.ok);
  registry('audit', { type: 'heal', subject: p.finding.subject, data: { code: p.finding.code, ok, results } });
  return { subject: p.finding.subject, code: p.finding.code, ok, results };
}

function recentlyHealed(subject) {
  try {
    return readFileSync(EVENTS, 'utf8').trim().split('\n').slice(-2000).some(line => {
      const e = JSON.parse(line);
      return e.type === 'dev.taskand.organism.heal' && e.subject === subject && Date.now() - Date.parse(e.time) < COOLDOWN_MS;
    });
  } catch {
    return false;
  }
}

function report() {
  const lines = [`[doctor] Samonaprawa (policy.healing=${policy}, tryb: ${mode === 'plan' ? 'tylko plan' : 'wykonanie'})`];
  lines.push(`  Przed: ${before.summary}`);
  for (const e of executed) {
    const last = e.results.at(-1) || {};
    lines.push(`  ${e.ok ? '✓' : '✗'} ${e.code} ${e.subject}: ${e.results.map(r => `${r.action || r.uri.split('/').slice(-2, -1)[0]}${r.ok ? '' : ` ✗ ${r.error}`}`).join(' → ')}${last.newUri ? ` → ${last.newUri} (${last.verdict || last.status})` : ''}`);
  }
  if (mode === 'plan') forOrganisms.forEach(p => lines.push(`  ⏸ ${p.finding.code} ${p.finding.subject}: ${p.why}`));
  skipped.forEach(s => lines.push(`  ⏭ ${s.subject}: ${s.reason}`));
  if (executed.length) lines.push(`  Po: ${after.summary}`);
  if (forHumans.length) {
    lines.push('  Wymaga człowieka:');
    forHumans.forEach(p => lines.push(`    · ${p.finding.code} ${p.finding.subject}: ${p.action}\n      (${p.why})`));
  }
  return lines.join('\n');
}

function done(out) {
  // A forced exit must not discard the tail of a large JSON response on a pipe.
  writeFileSync(1, JSON.stringify(out) + '\n');
  process.exit(0);
}
