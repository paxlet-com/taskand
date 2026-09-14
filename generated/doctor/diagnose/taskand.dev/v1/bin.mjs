#!/usr/bin/env node
// proc://taskand.dev/doctor/diagnose/v1 — diagnoza: sondy usług, integralność rejestru, zawodzące procesy (dziennik wywołań),
// zależności zewnętrzne. Wynik: findings[] {code, severity, subject, origin?, detail} + details[] dla człowieka.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { registry, call } from './registry-client.mjs';
import { diagnosticBudget, now, remaining, runChecks, probeService } from './probes.mjs';

let budget;
try {
  const raw = readFileSync(0, 'utf8').trim();
  budget = diagnosticBudget(raw ? JSON.parse(raw) : {});
} catch {
  process.stdout.write(JSON.stringify({ ok: false, errorType: 'INVALID_INPUT', error: 'Niepoprawne wejście lub budżet diagnozy' }) + '\n');
  process.exit(2);
}

const started = now();
const deadline = started + budget.deadline_ms;

const EVENTS = fileURLToPath(new URL('../../../../../log/events.jsonl', import.meta.url));
const FAILING_STREAK = 3;
const EVENTS_WINDOW = 2000;
const CRASH_TYPES = new Set(['EXEC_ERROR', 'CONTRACT_ERROR', 'OUTCOME_UNKNOWN']);

// Gateway w network_mode: host → usługi przez localhost; nazwy compose jako zapas
const SERVICES = [
  { name: 'gateway:8077', service: 'gateway', urls: ['http://localhost:8077/healthz', 'http://gateway:8077/healthz'] },
  { name: 'landing:8090', service: 'landing', urls: ['http://localhost:8090/', 'http://landing:80/'] },
  { name: 'vm-browser:3010 (noVNC)', service: 'vm-browser', urls: ['http://localhost:3010/', 'http://vm-browser:3000/'] }
];

const findings = [];
const details = [];
const find = (code, severity, subject, detail, extra = {}) => findings.push({ code, severity, subject, detail, ...extra });

async function checkRegistry() {
  const listing = await registry('list', {}, remaining(deadline));
  if (!Array.isArray(listing.processes) || listing.ok === false) {
    return find('REGISTRY_UNAVAILABLE', 'error', 'registry', 'Brak poprawnego katalogu procesów');
  }
  const entries = new Map(listing.processes.map(e => [e.uri, e]));
  const v = await registry('verify', {}, remaining(deadline));
  if (v.errorType || !Array.isArray(v.broken) || !Number.isInteger(v.checked)) {
    details.push('rejestr ✗ (brak poprawnego wyniku weryfikacji)');
    return find('REGISTRY_UNAVAILABLE', 'error', 'registry', 'Weryfikacja rejestru niedostępna');
  }
  for (const uri of v.broken) {
    const e = entries.get(uri);
    find('PACKAGE_TAMPERED', 'error', uri, 'Pliki pakietu zmienione po rejestracji', { origin: e?.origin, capability: e?.capability });
  }
  const pending = [...entries.values()].filter(e => e.status === 'candidate');
  for (const e of pending) find('CANDIDATE_PENDING', 'info', e.uri, 'Czeka na zatwierdzenie', { origin: e.origin });
  details.push(v.ok ? `rejestr: ${v.checked} procesów, bindingHash ✓${pending.length ? `, ${pending.length} czeka na zatwierdzenie` : ''}` : `rejestr ✗: zmienione pakiety: ${v.broken.join(', ')}`);
  checkFailingProcesses(entries);
}

// Proces zawodzi, gdy jego ostatnie FAILING_STREAK wywołań skończyło się błędem wykonania (nie ok:false z logiki)
function checkFailingProcesses(entries) {
  let lines = [];
  try {
    lines = readFileSync(EVENTS, 'utf8').trim().split('\n').slice(-EVENTS_WINDOW);
  } catch {
    return;
  }
  const bySubject = new Map();
  for (const line of lines) {
    try {
      const e = JSON.parse(line);
      if (e.type !== 'dev.taskand.proc.call') continue;
      if (!bySubject.has(e.subject)) bySubject.set(e.subject, []);
      bySubject.get(e.subject).push(e.data || {});
    } catch {}
  }
  for (const [uri, calls] of bySubject) {
    const entry = entries.get(uri);
    const recent = calls.slice(-FAILING_STREAK);
    if (entry?.status !== 'active' || recent.length < FAILING_STREAK || !recent.every(c => CRASH_TYPES.has(c.errorType))) continue;
    const lastError = recent.at(-1).error || recent.at(-1).errorType;
    find('PROCESS_FAILING', 'error', uri, `Ostatnie ${FAILING_STREAK} wywołania zakończone błędem: ${lastError}`, { origin: entry.origin, capability: entry.capability, lastError });
    details.push(`${uri} ✗ zawodzi (${recent.at(-1).errorType})`);
  }
}

async function checkVault() {
  const vault = await call('proc://taskand.dev/vault/secrets/v1', { action: 'status' }, remaining(deadline));
  if (vault.ok && !vault.initialized) find('VAULT_UNINITIALIZED', 'info', 'vault', 'Brak TASKAND_VAULT_KEY — credentialRef (np. alerty Telegram) nie zadziała');
  else if (vault.ok !== true) find('VAULT_STATUS_UNAVAILABLE', 'warning', 'vault', 'Status magazynu poświadczeń niedostępny');
}

async function checkBrowser() {
  const browser = await call('proc://taskand.dev/browser/session/v1', { action: 'status' }, remaining(deadline));
  if (browser.ok !== true) find('BROWSER_CDP_UNAVAILABLE', 'warning', 'vm-browser', 'Przeglądarka nie odpowiedziała poprawnie w budżecie diagnozy');
}

// Stan siatki węzłów (peery z genome) delegowany do cluster/monitor
async function checkPeers() {
  const c = await call('proc://taskand.dev/cluster/monitor/v1', {}, remaining(deadline));
  if (c.ok !== true || !Array.isArray(c.peers) || !Array.isArray(c.findings)) return find('CLUSTER_MONITOR_FAILED', 'warning', 'cluster', 'Brak poprawnego wyniku monitora węzłów');
  for (const f of c.findings || []) findings.push(f);
  if (c.peers?.length) details.push(c.summary);
}

const checks = [
  ...SERVICES.map(service => ({ name: service.service, run: () => probeService(service, deadline, budget.probe_timeout_ms) })),
  ...[['registry', checkRegistry], ['vault', checkVault], ['browser', checkBrowser], ['peers', checkPeers]].map(([name, run]) => ({
    name, run: async () => { await run(); return { findings: [], details: [], status: remaining(deadline) ? 'completed' : 'deadline' }; }
  }))
];
const results = await runChecks(checks, budget, deadline);
for (const result of results) { findings.push(...result.findings); details.push(...result.details); }

const problems = findings.filter(f => f.severity !== 'info');
process.stdout.write(JSON.stringify({
  ok: true,
  healthy: problems.length === 0,
  checks: details.length,
  passed: details.filter(d => d.includes('✓')).length,
  details,
  findings,
  metrics: { duration_ms: Math.round(now() - started), budget, deadline_exhausted: remaining(deadline) === 0, stages: results.map(r => ({ ...r.timing, ...(r.attempts ? { attempts: r.attempts } : {}) })) },
  summary: problems.length ? `${problems.length} problemów: ${[...new Set(problems.map(f => f.code))].join(', ')}` : 'System zdrowy',
  ts: new Date().toISOString()
}) + '\n');
process.exit(0);
