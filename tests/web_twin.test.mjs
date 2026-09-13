import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { transport, requestKey, normalizeURL, fixture } from '../generated/browser/web-model/taskand.dev/v1/transport.mjs';
import { validateSteps, evaluate } from '../generated/browser/web-model/taskand.dev/v1/scenario.mjs';
import { launchBrowser } from '../generated/browser/web-model/taskand.dev/v1/cdp.mjs';
import { createStore, save, load, hash } from '../generated/browser/web-model/taskand.dev/v1/store.mjs';

const MODEL = 'proc://taskand.dev/browser/web-model/v1', TWIN = 'proc://taskand.dev/twin/web/v1';
async function registry(action, payload = {}) {
  const p = spawn('node', ['generated/registry/core/taskand.dev/v1/bin.mjs'], { stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  p.stdout.on('data', b => { stdout += b; }); p.stderr.on('data', b => { stderr += b; });
  p.stdin.end(JSON.stringify({ action, ...payload }));
  const [code] = await once(p, 'close');
  assert.equal(code, 0, stderr);
  return JSON.parse(stdout);
}
const call = (uri, input) => registry('call', { uri, input, timeout_ms: 120000 });

test('HTTP identity is exact for method, URL query and body; fragments are not transmitted', () => {
  const request = { method: 'POST', url: 'https://example.invalid/api?a=1', postData: 'a=1' };
  assert.equal(requestKey(request), requestKey({ ...request, url: request.url + '#ui' }));
  for (const change of [{ method: 'GET' }, { postData: 'a=2' }, { url: 'https://example.invalid/api?a=2' }]) {
    assert.notEqual(requestKey(request), requestKey({ ...request, ...change }));
  }
  for (const url of ['file:///etc/passwd', 'https://user:password@example.invalid/']) assert.throws(() => normalizeURL(url));
  assert.throws(() => requestKey({ method: 'POST', url: request.url, hasPostData: true }), /Niepełna/);
});

test('capture refuses POST, undeclared origins and redirect fallback; strips credentials', async t => {
  const seen = [];
  const server = createServer((req, res) => {
    seen.push({ url: req.url, authorization: req.headers.authorization, cookie: req.headers.cookie });
    if (req.url === '/redirect') res.writeHead(302, { location: '/must-not-follow' });
    res.end('public');
  }).listen(0, '127.0.0.1');
  await once(server, 'listening'); t.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;
  const channel = transport({ mode: 'capture', origins: [origin] });
  assert.equal(await channel.acquire({ method: 'POST', url: origin + '/write', postData: 'test' }), null);
  assert.equal(await channel.acquire({ method: 'GET', url: 'http://localhost:' + server.address().port + '/other-origin' }), null);
  const captured = await channel.acquire({ method: 'GET', url: origin + '/redirect', headers: { Authorization: 'test-only', Cookie: 'test-only' } });
  assert.equal(captured.response.status, 302);
  assert.deepEqual(seen, [{ url: '/redirect', authorization: undefined, cookie: undefined }]);
  assert.equal(channel.blocked.length, 2);
});

test('offline mocks are labeled, exact and cannot replace captured answers', async () => {
  const mock = { method: 'POST', url: 'https://example.invalid/orders', body: '{"sku":"test"}', response: { status: 201, body: { id: 'synthetic-1' } } };
  const channel = transport({ mode: 'replay', origins: [], mocks: [mock] });
  const hit = await channel.acquire({ method: mock.method, url: mock.url, postData: mock.body });
  assert.equal(hit.provenance, 'synthetic'); assert.equal(hit.response.status, 201);
  assert.equal(await channel.acquire({ method: mock.method, url: mock.url, postData: '{"sku":"unknown"}' }), null);
  assert.equal(channel.misses.length, 1);
  assert.throws(() => transport({ mode: 'replay', origins: [], records: [fixture(mock)], mocks: [mock] }), /nadpisuje/);
  assert.throws(() => transport({ mode: 'unexpected', origins: [] }), /tryb/);
  assert.throws(() => fixture({ ...mock, body: { sku: 'test' } }), /ciągiem/);
});

test('model loading rejects traversal and inconsistent snapshot digest', () => {
  assert.throws(() => load('../../etc'));
  const valid = createStore(), snapshot = { entries: [], schema: 'taskand.web-model/v1' };
  save(valid.path, 'snapshot.json', snapshot); save(valid.path, 'manifest.json', { snapshotHash: hash(snapshot) });
  assert.deepEqual(load(valid.id).snapshot, snapshot);
  const invalid = createStore();
  save(invalid.path, 'snapshot.json', snapshot); save(invalid.path, 'manifest.json', { snapshotHash: hash('different') });
  assert.throws(() => load(invalid.id), /hash/);
});

test('scenario must assert results and cannot execute supplied JavaScript or file navigation', () => {
  assert.throws(() => validateSteps([{ action: 'goto', url: 'https://example.invalid' }]), /sprawdzenie/);
  assert.throws(() => validateSteps([{ action: 'eval', script: '1' }]), /akcja/);
  assert.throws(() => validateSteps([{ action: 'goto', url: 'file:///etc/passwd' }, { action: 'assert', selector: 'body' }]));
  assert.throws(() => validateSteps([null]));
});

test('registered web capabilities are reusable and safe on empty/invalid input', async () => {
  for (const uri of [MODEL, TWIN]) assert.equal((await call(uri, {})).status, 'READY');
  assert.equal((await call(MODEL, { action: 'status', modelId: '../escape' })).ok, false);
  assert.equal((await call(TWIN, { action: 'run', urls: ['https://example.invalid'] })).ok, false);
  const before = await registry('select', { organism: 'browser', capability: 'web-model' });
  const after = await registry('select', { organism: 'browser', capability: 'web-model' });
  assert.equal(before.uri, MODEL); assert.equal(before.entry.hash, after.entry.hash);
});

test('browser sandbox denies a reachable host server and host files without CDP interception', { timeout: 20000 }, async t => {
  let requests = 0;
  const server = createServer((_req, res) => { requests++; res.end('reachable-on-host'); }).listen(0, '127.0.0.1');
  await once(server, 'listening'); t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}/`;
  assert.equal(await (await fetch(url)).text(), 'reachable-on-host');
  const count = requests;
  const cdp = launchBrowser();
  try {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const result = await evaluate(cdp, sessionId, `fetch(${JSON.stringify(url)}, {mode:'no-cors',signal:AbortSignal.timeout(1000)}).then(()=>true,()=>false)`);
    assert.equal(result, false);
    assert.equal(requests, count);
    const file = await cdp.send('Page.navigate', { url: `file://${process.cwd()}/tests/web_twin.test.mjs` }, sessionId);
    assert.equal(file.errorText, 'net::ERR_FILE_NOT_FOUND');
  } finally { await cdp.close(); }
});

test('real Chromium replay survives a stopped source, blocks unknown API writes and gates the DAG', { timeout: 120000 }, async t => {
  let requests = 0;
  const server = createServer((req, res) => {
    requests++;
    if (req.url === '/api/info') { res.setHeader('content-type', 'application/json'); return res.end('{"ok":true,"name":"fixture"}'); }
    if (req.url === '/favicon.ico') { res.writeHead(204); return res.end(); }
    res.setHeader('content-type', 'text/html');
    res.end('<!doctype html><title>Offline fixture</title><link rel="icon" href="data:,"><input id="name" required><div id="result">ready</div><script>fetch("/api/info").then(r=>r.json()).then(r=>document.querySelector("#result").textContent=r.name)</script>');
  }).listen(0, '127.0.0.1');
  await once(server, 'listening'); t.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;
  const captured = await call(TWIN, { action: 'capture', urls: [origin + '/'] });
  assert.equal(captured.ok, true, JSON.stringify(captured));
  assert.equal(captured.reused, true); assert.equal(captured.generatedProcesses, 0);
  const count = requests;
  await new Promise(resolve => server.close(resolve));
  const steps = [
    { action: 'goto', url: origin + '/' },
    { action: 'assert', selector: '#result', textIncludes: 'fixture' },
    { action: 'assert', selector: '#name', valid: false },
    { action: 'fill', selector: '#name', value: 'test-only' },
    { action: 'assert', selector: '#name', valid: true },
    { action: 'request', url: origin + '/api/info', expect: { status: 200, json: { name: 'fixture', ok: true } } }
  ];
  const pass = await call(TWIN, { action: 'run', modelId: captured.modelId, steps });
  assert.equal(pass.ok, true, JSON.stringify(pass));
  assert.equal(pass.status, 'VERIFIED_SCENARIO'); assert.equal(pass.isolated.network, true);
  assert.equal(pass.backendVerified, false); assert.equal(pass.implementationVerified, false);
  const apiStep = { action: 'request', method: 'POST', url: origin + '/api/orders', body: '{"sku":"demo"}', expect: { status: 201, json: { id: 'synthetic-1' } } };
  const mocks = [{ method: apiStep.method, url: apiStep.url, body: apiStep.body, response: { status: 201, body: { id: 'synthetic-1' } } }];
  const synthetic = await call(TWIN, { action: 'run', modelId: captured.modelId, steps: [steps[0], apiStep], mocks });
  assert.equal(synthetic.ok, true, JSON.stringify(synthetic)); assert.equal(synthetic.syntheticHits, 1);
  assert.equal(synthetic.productionApproved, false);
  const selected = await registry('select', { organism: 'twin', capability: 'web' });
  const plan = { steps: [
    { id: 1, name: 'preflight', process: selected.uri, deps: [], params: { action: 'run', modelId: captured.modelId, steps: [steps[0], { ...apiStep, body: '{"sku":"unknown"}' }], mocks } },
    { id: 2, name: 'next_stage', process: MODEL, deps: ['preflight'], params: {} }
  ] };
  const approved = await call('proc://taskand.dev/validator/resolve/v1', { blueprint: plan });
  assert.equal(approved.valid, true, JSON.stringify(approved));
  const failed = await call('proc://taskand.dev/orchestrator/execute/v1', { runId: `web-test-${randomUUID()}`, approvedPlan: approved.approvedPlan });
  assert.equal(failed.ok, false);
  assert.equal(failed.steps.preflight.output.scenarioPassed, false);
  assert.ok(failed.steps.preflight.output.misses.some(r => r.method === 'POST' && r.url.endsWith('/api/orders')));
  assert.equal(failed.steps.next_stage.status, 'BLOCKED');
  assert.equal(requests, count, 'Replay contacted the source');
  assert.equal((await registry('resolve', { uri: selected.uri })).entry.hash, selected.entry.hash);
});
