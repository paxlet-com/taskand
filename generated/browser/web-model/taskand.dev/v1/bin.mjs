#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { drive } from './driver.mjs';
import { createStore, save, load, hash } from './store.mjs';
import { normalizeURL } from './transport.mjs';
import { validateSteps } from './scenario.mjs';

async function main(input) {
  const action = input.action;
  if (!action) return { ok: true, status: 'READY', usage: 'action: capture (urls, allowedOrigins?) | replay (modelId, steps, mocks?) | status (modelId)' };
  if (action === 'status') return { ok: true, ...load(input.modelId).manifest, active: false };
  if (action === 'capture') {
    if (!Array.isArray(input.urls) || !input.urls.length || input.urls.length > 5) throw new Error('Wymagane 1–5 urls');
    const urls = input.urls.map(normalizeURL);
    const origins = [...new Set([...urls, ...(input.allowedOrigins || [])].map(u => new URL(normalizeURL(u)).origin))];
    const store = createStore();
    const captured = await drive({ action, urls, origins, path: store.path });
    const snapshot = { schema: 'taskand.web-model/v1', capturedAt: new Date().toISOString(), urls, origins,
      entries: captured.entries, pages: captured.pages, blocked: captured.blocked, errors: captured.errors, exceptions: captured.exceptions,
      browser: captured.browser,
      fidelity: { backend: 'not-captured', authenticated: false, cookies: 'not-forwarded-or-persisted', requestMatching: 'method-url-body', capturedMethods: ['GET'] } };
    const manifest = { modelId: store.id, snapshotHash: hash(snapshot), resources: snapshot.entries.length,
      urls, capturedAt: snapshot.capturedAt, pages: snapshot.pages, blockedRequests: captured.blocked.length,
      captureErrors: captured.errors, artifacts: { snapshot: join(store.path, 'snapshot.json'), manifest: join(store.path, 'manifest.json') } };
    save(store.path, 'snapshot.json', snapshot); save(store.path, 'manifest.json', manifest);
    const documents = urls.map(url => snapshot.entries.find(e => e.request.url === url));
    const ok = documents.every(e => e?.response.status >= 200 && e?.response.status < 400);
    return { ok, ...manifest, status: 'CAPTURED', isolated: captured.isolated,
      summary: `Zapisano ${manifest.resources} zasobów ${urls.length} stron. Backend i logowanie pozostają niezweryfikowane.` };
  }
  if (action === 'replay') {
    validateSteps(input.steps);
    const model = load(input.modelId), run = createStore();
    const replay = await drive({ action, origins: model.snapshot.origins, records: model.snapshot.entries,
      mocks: input.mocks || [], steps: input.steps, path: run.path });
    const scenarioPassed = replay.checks.length === input.steps.length && replay.checks.every(c => c.ok);
    const complete = !replay.misses.length && !replay.errors.length && !replay.exceptions.length;
    const out = { ok: scenarioPassed && complete, status: !scenarioPassed ? 'FAILED' : complete ? 'VERIFIED_SCENARIO' : 'PARTIAL',
      modelId: input.modelId, runId: run.id, snapshotHash: model.manifest.snapshotHash,
      scenarioHash: hash(input.steps), mockHash: hash(input.mocks || []), checks: replay.checks,
      scenarioPassed, coverageComplete: complete, misses: replay.misses, errors: replay.errors, exceptions: replay.exceptions,
      isolated: replay.isolated, browser: replay.browser, syntheticHits: replay.syntheticHits, productionApproved: false, implementationVerified: false,
      backendVerified: false, active: false, screenshot: join(run.path, 'replay.png'), receipt: join(run.path, 'receipt.json'),
      summary: `Scenariusz: ${scenarioPassed ? 'PASS' : 'FAIL'}, brakujące żądania: ${replay.misses.length}. Wynik dotyczy zapisanej migawki i jawnych modeli odpowiedzi.` };
    save(run.path, 'receipt.json', out); return out;
  }
  throw new Error('Nieznana akcja web-model');
}
let out;
try { const raw = JSON.parse(readFileSync(0, 'utf8').trim() || '{}'); out = await main(raw.params || raw); }
catch (err) { out = { ok: false, errorType: 'WEB_MODEL_FAILED', error: err.message }; }
process.stdout.write(JSON.stringify(out) + '\n');
