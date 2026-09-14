#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { registry, call } from './registry-client.mjs';

function main(input) {
  if (!input.action) return { ok: true, status: 'READY', usage: '{action:"run",urls:[...],steps:[...]} albo {action:"run",modelId,steps,mocks?}' };
  if (!['run', 'capture'].includes(input.action)) throw new Error('action: run|capture');
  if (input.action === 'run' && (!Array.isArray(input.steps) || !input.steps.length)) throw new Error('Brak scenariusza i kryteriów sprawdzenia zadania (steps)');
  const catalog = registry('list');
  if (!catalog.ok) throw new Error(catalog.error);
  const selected = registry('select', { organism: 'browser', capability: 'web-model' });
  if (!selected.ok) throw new Error(selected.error);
  const process = { uri: selected.uri, hash: selected.entry.hash };
  let modelId = input.modelId, captured;
  if (!modelId) {
    captured = call(selected.uri, { action: 'capture', urls: input.urls, allowedOrigins: input.allowedOrigins }, 150000);
    if (!captured.ok) return { ...captured, process };
    modelId = captured.modelId;
  }
  const result = input.action === 'capture' ? captured || call(selected.uri, { action: 'status', modelId })
    : call(selected.uri, { action: 'replay', modelId, steps: input.steps, mocks: input.mocks }, 150000);
  const current = registry('resolve', { uri: selected.uri });
  if (!current.ok || current.entry.hash !== process.hash) throw new Error('Zmienił się proces obsługujący model podczas zadania');
  registry('audit', { type: 'twin.web.completed', subject: modelId,
    data: { ok: result.ok, status: result.status, process, snapshotHash: result.snapshotHash, scenarioHash: result.scenarioHash } });
  return { ...result, process, reused: true, generatedProcesses: 0, catalogOrganisms: new Set(catalog.processes.map(p => p.organism)).size,
    capture: captured ? { resources: captured.resources, modelId, blockedRequests: captured.blockedRequests } : undefined };
}
let out;
try { const raw = JSON.parse(readFileSync(0, 'utf8').trim() || '{}'); out = main(raw.params || raw); }
catch (err) { out = { ok: false, errorType: 'WEB_TWIN_FAILED', error: err.message }; }
process.stdout.write(JSON.stringify(out) + '\n');
