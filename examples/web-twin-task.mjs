#!/usr/bin/env node
// Public GET capture (or --model offline reuse) -> registry URI -> validator -> DAG -> receipt.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2), target = args[0] || 'github';
const specPath = ['github', 'subactor'].includes(target) ? join(root, `examples/web-twin-${target}.json`) : target;
const spec = JSON.parse(readFileSync(specPath, 'utf8'));
if (args.includes('--model')) {
  spec.modelId = args[args.indexOf('--model') + 1];
  assert.ok(spec.modelId, '--model wymaga identyfikatora zapisanej migawki');
}
function registry(action, payload = {}, timeout = 350000) {
  const r = spawnSync('node', [join(root, 'generated/registry/core/taskand.dev/v1/bin.mjs')], {
    input: JSON.stringify({ action, ...payload }), encoding: 'utf8', timeout, maxBuffer: 32 * 1024 * 1024
  });
  if (r.error) throw r.error;
  return JSON.parse(r.stdout);
}
const call = (uri, input) => registry('call', { uri, input, timeout_ms: 340000 });
const before = registry('list');
const selected = registry('select', { organism: 'twin', capability: 'web' });
assert.equal(selected.ok, true, selected.error);
const taskId = `web-preflight-${randomUUID()}`;
const plan = { goal: `Sprawdzenie scenariusza offline przed implementacją: ${target}`, steps: [
  { id: 1, name: 'web_preflight', process: selected.uri, deps: [], params: spec },
  // Harmless marker, not implementation or deployment. Tests dependency gating on PARTIAL.
  { id: 2, name: 'dependent_step_marker', process: 'proc://taskand.dev/browser/web-model/v1', deps: ['web_preflight'], params: {} }
] };
const approved = call('proc://taskand.dev/validator/resolve/v1', { blueprint: plan });
assert.equal(approved.valid, true, JSON.stringify(approved.errors));
const dir = join(root, 'log/tasks');
mkdirSync(dir, { recursive: true, mode: 0o700 });
writeFileSync(join(dir, `${taskId}.json`), JSON.stringify({ taskId, plan, selected }, null, 2), { flag: 'wx', mode: 0o600 });
const result = call('proc://taskand.dev/orchestrator/execute/v1', { runId: taskId, approvedPlan: approved.approvedPlan });
const output = result.steps?.web_preflight?.output;
const bindings = catalog => catalog.processes.map(p => `${p.uri}|${p.hash}|${p.status}`).sort();
assert.deepEqual(bindings(before), bindings(registry('list')), 'Zmiana bindingów rejestru podczas zadania');
assert.equal(output?.reused, true, JSON.stringify(output || result));
if (!output.ok) assert.equal(result.steps.dependent_step_marker.status, 'BLOCKED');
console.log(JSON.stringify({ taskId, state: result.status, ...output,
  dependentStep: result.steps.dependent_step_marker.status, registryBindingsUnchanged: true }, null, 2));
// PARTIAL is intentionally not a successful preflight, even when all UI assertions pass.
process.exitCode = output.ok ? 0 : 1;
