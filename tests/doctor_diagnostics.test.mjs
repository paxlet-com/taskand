import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { diagnosticBudget, now, runChecks, probeService } from '../generated/doctor/diagnose/taskand.dev/v1/probes.mjs';

test('automatic CPU budget is bounded; explicit valid budgets are retained', () => {
  assert.equal(diagnosticBudget({}, 1).concurrency, 1);
  assert.equal(diagnosticBudget({}, 128).concurrency, 4);
  assert.equal(diagnosticBudget().deadline_ms, 6000);
  assert.deepEqual(diagnosticBudget({ budget: { deadline_ms: 12000, concurrency: 2, probe_timeout_ms: 3500 } }), { deadline_ms: 12000, concurrency: 2, probe_timeout_ms: 3500 });
  assert.equal(diagnosticBudget({ budget: { deadline_ms: 250 } }).probe_timeout_ms, 250);
});

test('malformed budgets cannot silently widen limits', () => {
  for (const budget of [[], 'slow', { deadline_ms: 15001 }, { deadline_ms: 0 }, { concurrency: 5 }, { concurrency: 1.5 }, { concurrency: '4' }, { unknown: 1 }]) {
    assert.throws(() => diagnosticBudget({ budget }));
  }
  assert.throws(() => diagnosticBudget(null));
});

test('bounded workers retain source order despite out-of-order completion', async () => {
  let active = 0, peak = 0;
  const checks = [60, 10, 20, 10].map((ms, i) => ({ name: `check-${i}`, run: async () => {
    active++; peak = Math.max(active, peak); await delay(ms); active--;
    return { findings: [], details: [i] };
  } }));
  const results = await runChecks(checks, { concurrency: 2 }, now() + 1000);
  assert.equal(peak, 2);
  assert.deepEqual(results.map(r => r.details[0]), [0, 1, 2, 3]);
});

test('expired queued checks are visible and never dispatched', async () => {
  let dispatched = false;
  const checks = [{ name: 'first', run: async () => { await delay(50); return { findings: [], details: [] }; } },
    { name: 'second', run: async () => { dispatched = true; } }];
  const results = await runChecks(checks, { concurrency: 1 }, now() + 20);
  assert.equal(dispatched, false);
  assert.equal(results[1].findings[0].code, 'DIAGNOSTIC_DEADLINE');
});

test('unexpected check errors retain a finding and redact exception text', async () => {
  const result = await runChecks([{ name: 'broken', run: () => { throw new Error('PRIVATE_MARKER'); } }], { concurrency: 1 }, now() + 100);
  assert.equal(result[0].findings[0].code, 'DIAGNOSTIC_CHECK_FAILED');
  assert.ok(!JSON.stringify(result).includes('PRIVATE_MARKER'));
});

const service = urls => ({ name: 'fixture', service: 'fixture', urls });

test('slow DNS/non-cooperative transport cannot reset the shared deadline', async () => {
  let attempts = 0, aborted = 0;
  const start = now();
  const result = await probeService(service(['http://first', 'http://second', 'http://third']), start + 90, 60, (_url, { signal }) => {
    attempts++; signal.addEventListener('abort', () => aborted++);
    return new Promise(() => {});
  });
  assert.ok(now() - start < 250);
  assert.equal(attempts, 2);
  assert.equal(aborted, 2);
  assert.equal(result.findings[0].code, 'SERVICE_DOWN');
  assert.equal(result.status, 'deadline');
});

test('DNS failure falls back; successful address stops further probes', async () => {
  let attempts = 0;
  const result = await probeService(service(['http://first', 'http://second', 'http://third']), now() + 1000, 100, async () => {
    if (++attempts === 1) throw Object.assign(new Error('DNS failure'), { code: 'EAI_AGAIN' });
    return { status: 200 };
  });
  assert.equal(attempts, 2);
  assert.deepEqual(result.findings, []);
  assert.equal(result.attempts[0].status, 'unavailable');
});

async function httpFixture(t, handler) {
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  return `http://127.0.0.1:${server.address().port}`;
}

test('HTTP 503 is unavailable, 401 proves liveness without granting readiness', async t => {
  const url = await httpFixture(t, (req, res) => { res.writeHead(req.url === '/bad' ? 503 : 401); res.end(); });
  const result = await probeService(service([url + '/bad', url + '/auth']), now() + 1000, 500);
  assert.equal(result.status, 'available');
  assert.deepEqual(result.attempts.map(a => a.http_status), [503, 401]);
});

test('partial HTTP bodies are cancelled without waiting for download', async t => {
  const url = await httpFixture(t, (_req, res) => { res.writeHead(200); res.write('partial'); });
  const start = now();
  const result = await probeService(service([url]), now() + 500, 200);
  assert.equal(result.status, 'available');
  assert.ok(now() - start < 500);
});

test('silent HTTP endpoint reaches timeout and yields a service finding', async t => {
  const url = await httpFixture(t, () => {});
  const result = await probeService(service([url]), now() + 100, 60);
  assert.equal(result.findings[0].code, 'SERVICE_DOWN');
  assert.equal(result.attempts[0].status, 'timeout');
});

test('connection refusal yields a concrete unavailable result', async t => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  await new Promise(resolve => server.close(resolve));
  const result = await probeService(service([url]), now() + 500, 100);
  assert.equal(result.findings[0].code, 'SERVICE_DOWN');
  assert.equal(result.attempts[0].status, 'unavailable');
});

async function registryFixture(t, source) {
  const root = mkdtempSync(join(tmpdir(), 'taskand-registry-deadline-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const client = join(root, 'generated/doctor/diagnose/taskand.dev/v1');
  const broker = join(root, 'generated/registry/core/taskand.dev/v1');
  mkdirSync(client, { recursive: true }); mkdirSync(broker, { recursive: true });
  copyFileSync(new URL('../generated/doctor/diagnose/taskand.dev/v1/registry-client.mjs', import.meta.url), join(client, 'registry-client.mjs'));
  writeFileSync(join(broker, 'bin.mjs'), source);
  return { root, ...await import(pathToFileURL(join(client, 'registry-client.mjs'))) };
}

test('malformed registry output and private stderr never become success or leaked text', async t => {
  const { registry } = await registryFixture(t, "process.stderr.write('PRIVATE_MARKER'); process.stdout.write('null');");
  const result = await registry('list', {}, 500);
  assert.equal(result.errorType, 'REGISTRY_ERROR');
  assert.ok(!JSON.stringify(result).includes('PRIVATE_MARKER'));
  assert.equal((await registry('list', {}, 0)).errorType, 'REGISTRY_TIMEOUT');
});

test('registry timeout kills the broker process group including descendants', { skip: process.platform === 'win32' }, async t => {
  const { root, registry } = await registryFixture(t, `
    import { spawn } from 'node:child_process';
    import { readFileSync } from 'node:fs';
    const { marker } = JSON.parse(readFileSync(0, 'utf8'));
    spawn(process.execPath, ['-e', 'setTimeout(() => require("fs").writeFileSync(process.argv[1], "orphan"), 600)', marker], { stdio: 'inherit' });
    setInterval(() => {}, 1000);
  `);
  const marker = join(root, 'orphan.txt'), start = now();
  const result = await registry('list', { marker }, 150);
  assert.equal(result.errorType, 'REGISTRY_TIMEOUT');
  assert.ok(now() - start < 500);
  await delay(750);
  assert.equal(existsSync(marker), false);
});
