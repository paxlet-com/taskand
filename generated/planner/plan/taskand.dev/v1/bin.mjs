#!/usr/bin/env node
// proc://taskand.dev/planner/plan/v1 — registry-derived request-only DSL; never execution authority.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { registry, call } from './registry-client.mjs';

const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const closed = (x, keys) => object(x) && Object.keys(x).every(k => keys.includes(k)) && keys.every(k => Object.hasOwn(x, k));
const hash = x => 'sha256:' + createHash('sha256').update(JSON.stringify(x)).digest('hex');
const string = { type: 'string', minLength: 1 };
const properties = { id: { type: 'integer', minimum: 1 }, name: string,
  type: { enum: ['worker', 'interface', 'security', 'adapter'] }, process: string,
  description: string, deps: { type: 'array', items: string, uniqueItems: true }, params: { type: 'object', additionalProperties: false,
    properties: { op: { enum: ['list', 'read', 'stat', 'exists'] }, path: string, max_bytes: { type: 'integer', minimum: 1, maximum: 1048576 } } } };
const schema = { type: 'object', additionalProperties: false, required: ['blueprint'], properties: {
  blueprint: { type: 'object', additionalProperties: false, required: ['goal', 'steps'], properties: {
    goal: string, steps: { type: 'array', minItems: 1, maxItems: 32,
      items: { type: 'object', additionalProperties: false, required: Object.keys(properties), properties } } } } } };
const rules = [
  { id: 'P-URI-001', when: 'STEP_PROPOSED', require: ['EXACT_ACTIVE_REGISTRY_URI', 'CURRENT_BINDING_HASH'], forbid: ['SPAWN_IF_REUSABLE', 'INVENTED_URI'] },
  { id: 'P-REF-001', when: 'CONTEXT_REFERENCED', require: ['EXISTING_OWNER_SCOPED_IMMUTABLE_URN'], forbid: ['INFERRED_OBJECT', 'INFERRED_AUTHORITY'] },
  { id: 'P-DAG-001', when: 'PLAN_RETURNED', require: ['NONEMPTY_CLOSED_REQUEST', 'UNIQUE_IDS_AND_NAMES', 'EXISTING_DEPENDENCIES', 'ACYCLIC_GRAPH', 'UNCHANGED_GOAL'] },
  { id: 'P-TWIN-001', when: 'EFFECT_PLANNED', require: ['EXPLICIT_TWIN_COVERAGE', 'SCENARIO_EVIDENCE', 'CONTROLLER_AUTHORIZATION'], forbid: ['PRODUCTION_AS_TEST_FALLBACK', 'PARTIAL_AS_FULL_SUCCESS'] },
  { id: 'P-SECRET-001', when: 'PARAMETERS_PROPOSED', forbid: ['INLINE_SECRETS', 'INVENTED_VAULT_REFERENCE', 'SECRET_AUTOCORRECTION'] },
  { id: 'P-EXEC-001', when: 'MODEL_RETURNS', require: ['LOCAL_DETERMINISTIC_VALIDATION'], forbid: ['MODEL_APPROVAL', 'AUTOMATIC_EVOLUTION', 'AUTOMATIC_PRODUCTION_EXECUTION'] }
];

function unsafe(value, depth = 0) {
  if (depth > 20) return true;
  if (typeof value === 'string') return /vault:\/\/|Bearer\s+\S+|\b(?:ghp_|sk-)[A-Za-z0-9_-]{12,}/i.test(value);
  if (Array.isArray(value)) return value.some(v => unsafe(v, depth + 1));
  return object(value) && Object.entries(value).some(([k, v]) => /token|secret|password|api.?key|credentialRef/i.test(k) || unsafe(v, depth + 1));
}

function validate(candidate, task, catalog) {
  const errors = [];
  if (!closed(candidate, ['blueprint']) || !closed(candidate.blueprint, ['goal', 'steps'])) return ['DSL_CLOSED_REQUEST_REQUIRED'];
  const { goal, steps } = candidate.blueprint;
  if (goal !== task) errors.push('DSL_GOAL_CHANGED');
  if (!Array.isArray(steps) || steps.length < 1 || steps.length > 32) return [...errors, 'DSL_NONEMPTY_BOUNDED_STEPS_REQUIRED'];
  const names = new Set(), ids = new Set(), bindings = new Map(catalog.map(p => [p.uri, p.bindingHash]));
  for (const s of steps) {
    if (!closed(s, Object.keys(properties))) { errors.push('DSL_STEP_SHAPE'); continue; }
    if (!Number.isInteger(s.id) || s.id < 1 || ids.has(s.id)) errors.push('DSL_STEP_ID');
    if (typeof s.name !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(s.name) || names.has(s.name)) errors.push('DSL_STEP_NAME');
    ids.add(s.id); names.add(s.name);
    if (!properties.type.enum.includes(s.type) || typeof s.description !== 'string' || !s.description.trim()) errors.push('DSL_STEP_METADATA');
    if (!Array.isArray(s.deps) || s.deps.some(d => typeof d !== 'string') || new Set(s.deps).size !== s.deps.length) errors.push('DSL_DEPENDENCIES');
    if (!object(s.params) || unsafe(s.params)) errors.push('DSL_UNRESOLVED_OR_INLINE_SECRET');
    if (!bindings.has(s.process)) { errors.push('DSL_UNRESOLVED_PROCESS'); continue; }
    const resolved = registry('resolve', { uri: s.process });
    if (!resolved.ok || resolved.entry.hash !== bindings.get(s.process)) errors.push('DSL_BINDING_CHANGED');
    if (/\/file\/ops\//.test(s.process)) {
      if (!object(s.params) || Object.keys(s.params).some(k => !['op', 'path', 'max_bytes'].includes(k)) ||
          !['list', 'read', 'stat', 'exists'].includes(s.params.op) || typeof s.params.path !== 'string' ||
          !s.params.path.startsWith('/') || /TBD|TODO|auto.detect/i.test(s.params.path) ||
          (s.params.max_bytes !== undefined && (!Number.isInteger(s.params.max_bytes) || s.params.max_bytes < 1 || s.params.max_bytes > 1048576))) errors.push('DSL_FILE_INPUT_CONTRACT');
    } else if (/\/twin\/web\//.test(s.process)) {
      if (!object(s.params) || s.params.action !== 'run' || !Array.isArray(s.params.steps) ||
          !s.params.steps.length || s.params.steps.some(x => !object(x) || typeof x.action !== 'string') ||
          !s.params.steps.some(x => ['assert', 'request'].includes(x.action))) errors.push('DSL_WEB_SCENARIO_CONTRACT');
      errors.push('DSL_WEB_FULL_INPUT_SCHEMA_UNAVAILABLE');
    } else if (/\/monitor\/cpu\//.test(s.process)) {
      if (!object(s.params) || Object.keys(s.params).length) errors.push('DSL_CPU_INPUT_CONTRACT');
    } else errors.push('DSL_PROCESS_INPUT_CONTRACT_UNAVAILABLE');
  }
  const map = new Map(steps.filter(object).map(s => [s.name, s])), colors = new Map();
  function visit(name) {
    if (colors.get(name) === 1) { errors.push('DSL_DEPENDENCY_CYCLE'); return; }
    if (colors.get(name) === 2) return;
    colors.set(name, 1);
    for (const dep of Array.isArray(map.get(name)?.deps) ? map.get(name).deps : []) {
      if (!names.has(dep)) errors.push('DSL_DEPENDENCY_MISSING'); else visit(dep);
    }
    colors.set(name, 2);
  }
  for (const name of names) visit(name);
  return [...new Set(errors)];
}

function main(raw) {
  const input = object(raw.params) ? raw.params : raw;
  if (!object(input)) throw new Error('DSL_INPUT_OBJECT_REQUIRED');
  const task = input.task ?? input.message ?? '';
  if (typeof task !== 'string' || task.length > 32000) throw new Error('DSL_TASK_INVALID');
  if (!task.trim()) return { ok: true, valid: false, status: 'READY', usage: '{task,action?:compile|plan}' };
  if (!['compile', 'plan', undefined].includes(input.action)) throw new Error('DSL_ACTION_INVALID');
  const listed = registry('list', { status: 'active' });
  if (!listed.ok) throw new Error('DSL_REGISTRY_UNAVAILABLE');
  const catalog = listed.processes.map(p => ({ uri: p.uri, bindingHash: p.hash, kind: p.kind, descriptionData: p.desc || '' })).sort((a, b) => a.uri.localeCompare(b.uri));
  const refs = input.contextRefs ?? [], context = input._context ?? { promptRef: null, objects: [] };
  if (!Array.isArray(refs) || refs.length > 64 || !object(context) || !Array.isArray(context.objects)) throw new Error('DSL_CONTEXT_INVALID');
  if (refs.some(ref => !context.objects.some(o => o.urn === ref && /^[a-f0-9]{64}$/.test(o.digest)))) throw new Error('DSL_CONTEXT_REFERENCE_UNRESOLVED');
  const dsl = { DOCUMENT: 'TASKAND_PLANNER', VERSION: 1, LANGUAGE: 'PL', MODE: 'REQUEST_ONLY',
    RULES: rules, INPUT: { NL: task, promptRef: context.promptRef, contextRefs: refs },
    REGISTRIES: { processes: catalog, objects: context.objects }, OUTPUT_SCHEMA: schema,
    CONSTRAINTS: { authority: 'ADVISORY', providerGBNF: 'NOT_VERIFIED', localValidation: 'REQUIRED',
      productionApproved: false, unknownDevicePolicy: 'UNKNOWN_UNTIL_OBSERVED', twinComposition: 'PIN_IMMUTABLE_REVISIONS' } };
  const common = { dsl, dslDigest: hash(dsl), registryDigest: hash(catalog), goal: task, goalPreserved: true,
    valid: false, executionReady: false, productionApproved: false };
  if (input.action === 'compile') return { ...common, ok: true, status: 'COMPILED' };
  const llm = input.candidate === undefined ? call('proc://taskand.dev/dev/llm/v1', {
    system: JSON.stringify(dsl), prompt: JSON.stringify({ DOCUMENT: 'TASKAND_REQUEST', INPUT: dsl.INPUT }),
    json: true, temperature: 0.1, max_tokens: 4000
  }, 120000) : { ok: true, json: input.candidate };
  if (!llm.ok) {
    const detail = String(llm.error || '');
    const failureType = /brak TASKAND_LLM_API_KEY/.test(detail) ? 'CONFIGURATION_MISSING'
      : /timeout|timed out|aborted/i.test(detail) ? 'TIMEOUT'
      : /poprawnego JSON/.test(detail) ? 'RESPONSE_NOT_JSON'
      : /HTTP (\d{3})/.test(detail) ? 'HTTP_' + detail.match(/HTTP (\d{3})/)[1] : 'UPSTREAM_ERROR';
    return { ...common, ok: false, status: 'PLANNING_UNAVAILABLE', failureType,
      reason: 'DSL_LLM_UNAVAILABLE: ' + failureType + '; bez zastępczego celu i bez wykonania.' };
  }
  const errors = validate(llm.json, task, catalog);
  if (errors.length) return { ...common, ok: false, status: 'REJECTED', errors, reason: errors.join(', ') };
  return { ...common, ok: true, status: 'NEEDS_EXECUTION_CONTRACT', contractValid: true,
    proposal: llm.json.blueprint,
    reason: 'Kandydat DSL: brak zweryfikowanego request-only GBNF oraz powiązanego dowodu twin i autoryzacji kontrolera. Wykonanie zablokowane.' };
}

let result;
try { result = main(JSON.parse(readFileSync(0, 'utf8').trim() || '{}')); }
catch (error) { result = { ok: false, valid: false, status: 'REJECTED', error: error.message, productionApproved: false }; }
process.stdout.write(JSON.stringify(result) + '\n');
