import { availableParallelism } from 'node:os';
import { performance } from 'node:perf_hooks';

export const now = () => performance.now();
export const remaining = deadline => Math.max(0, Math.ceil(deadline - now()));

export function diagnosticBudget(input = {}, cpus = availableParallelism()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Expected an input object');
  const requested = input.budget ?? {};
  if (!requested || typeof requested !== 'object' || Array.isArray(requested)) throw new Error('Expected a budget object');
  const defaults = { deadline_ms: 6000, concurrency: Math.max(1, Math.min(4, Math.floor(cpus / 2))), probe_timeout_ms: 2000 };
  const limits = { deadline_ms: [250, 15000], concurrency: [1, 4], probe_timeout_ms: [50, 5000] };
  for (const [key, value] of Object.entries(requested)) {
    if (!limits[key] || !Number.isInteger(value) || value < limits[key][0] || value > limits[key][1]) throw new Error(`Invalid diagnostic budget: ${key}`);
  }
  const budget = { ...defaults, ...requested };
  budget.probe_timeout_ms = Math.min(budget.probe_timeout_ms, budget.deadline_ms);
  return budget;
}

// Stable output order, bounded in-flight work, no fresh deadline per queue item.
export async function runChecks(checks, budget, deadline) {
  const results = new Array(checks.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(budget.concurrency, checks.length) }, async () => {
    while (next < checks.length) {
      const index = next++, check = checks[index], started = now();
      let result;
      try {
        result = remaining(deadline) ? await check.run(deadline) : {
          findings: [{ code: 'DIAGNOSTIC_DEADLINE', severity: 'warning', subject: check.name, detail: 'Nie uruchomiono: wyczerpany wspólny budżet diagnozy' }],
          details: [], status: 'deadline'
        };
      } catch {
        result = { findings: [{ code: 'DIAGNOSTIC_CHECK_FAILED', severity: 'error', subject: check.name, detail: 'Nie udało się odczytać wyniku kontroli' }], details: [], status: 'error' };
      }
      results[index] = { ...result, timing: { check: check.name, duration_ms: Math.round(now() - started), status: result.status || 'completed' } };
    }
  }));
  return results;
}

export async function probeService(service, deadline, timeout, request = fetch) {
  const attempts = [];
  let up = false;
  for (const url of service.urls) {
    const ms = Math.min(timeout, remaining(deadline));
    if (!ms) break;
    const controller = new AbortController(), started = now();
    let timer;
    // Bound DNS or a transport that fails to honor cancellation as well.
    const expired = new Promise(resolve => {
      timer = setTimeout(() => { controller.abort(); resolve({ status: 'timeout' }); }, ms);
    });
    const response = Promise.resolve().then(() => request(url, { signal: controller.signal })).then(r => {
      if (r.body) Promise.resolve(r.body.cancel()).catch(() => {});
      return { status: 'response', http_status: r.status, up: r.status < 500 };
    }, () => ({ status: controller.signal.aborted ? 'timeout' : 'unavailable' }));
    const outcome = await Promise.race([response, expired]);
    clearTimeout(timer);
    attempts.push({ ...outcome, duration_ms: Math.round(now() - started) });
    if (outcome.up) { up = true; break; }
  }
  return {
    details: [`${service.name} ${up ? '✓' : '✗ (brak odpowiedzi)'}`],
    findings: up ? [] : [{ code: 'SERVICE_DOWN', severity: 'error', subject: service.service, detail: `${service.name} nie odpowiada` }],
    status: up ? 'available' : remaining(deadline) ? 'unavailable' : 'deadline', attempts
  };
}
