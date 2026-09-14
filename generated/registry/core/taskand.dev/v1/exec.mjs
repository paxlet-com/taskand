// Wywołanie procesu przez URI: rejestr → status active → bindingHash → izolowane env (+granty, +credentialRef) → spawn
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { ROOT, parseUri, findEntry, audit } from './store.mjs';
import { packageHash } from './package.mjs';
import { openSecret } from './vault.mjs';

const MAX_DEPTH = 12;

// Broker sekretów: wartości tylko dla nazw zadeklarowanych w proc.yaml (env: [...]) procesu docelowego
function secretSource() {
  const fromFile = {};
  try {
    for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m) fromFile[m[1]] = m[2];
    }
  } catch {}
  return { ...fromFile, ...process.env };
}

export function resolve(uri) {
  if (!parseUri(uri)) return fail('NOT_FOUND', `Niepoprawny URI procesu: ${uri}`);
  const entry = findEntry(uri);
  if (!entry) return fail('NOT_FOUND', `URI nieznany w rejestrze: ${uri}`);
  if (entry.status !== 'active') return fail('DENIED', `Proces ${uri} ma status "${entry.status}" (wymagane: active)`);
  const actual = packageHash(parseUri(uri).dir);
  if (actual !== entry.hash) return fail('DENIED', `Naruszenie integralności bindingHash: ${uri}`);
  return { ok: true, entry };
}

const fail = (errorType, error, extra = {}) => ({ ok: false, errorType, error, ...extra });
const matches = (ref, patterns) => patterns.some(p => (p.endsWith('*') ? ref.startsWith(p.slice(0, -1)) : ref === p));

function credentialEnv(entry, input, secrets) {
  const ref = input?.credentialRef || input?.params?.credentialRef;
  if (!ref) return {};
  const [path, query = ''] = ref.split('?');
  if (!matches(path, entry.credentials || [])) {
    return { TASKAND_CREDENTIAL_ERROR: `Proces nie deklaruje dostępu do ${path}` };
  }
  const purpose = new URLSearchParams(query).get('purpose') || entry.uri;
  const v = openSecret(path.replace('vault://', ''), secrets.TASKAND_VAULT_KEY);
  audit('vault.resolve', path, { for: entry.uri, purpose, ok: v.ok });
  return v.ok ? { TASKAND_CREDENTIAL: v.value } : { TASKAND_CREDENTIAL_ERROR: v.error };
}

export function call({ uri, input = {}, timeout_ms = 60000 }, depth = Number(process.env.TASKAND_CALL_DEPTH || 0)) {
  if (depth >= MAX_DEPTH) return fail('DENIED', `Przekroczona głębokość wywołań (${MAX_DEPTH}) przy ${uri}`);
  const res = resolve(uri);
  if (!res.ok) return res;
  const { entry } = res;
  const secrets = secretSource();
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME || '/tmp',
    LANG: 'C.UTF-8',
    TASKAND_CALL_DEPTH: String(depth + 1),
    TASKAND_CALLER: uri,
    ...Object.fromEntries((entry.env || []).filter(k => secrets[k] !== undefined).map(k => [k, secrets[k]])),
    ...credentialEnv(entry, input, secrets)
  };
  const started = Date.now();
  const r = spawnSync('node', [join(parseUri(uri).dir, 'bin.mjs')], {
    input: JSON.stringify(input), encoding: 'utf8', timeout: timeout_ms, env, maxBuffer: 16 * 1024 * 1024
  });
  const out = outcome(r, timeout_ms);
  audit('proc.call', uri, { exit: r.status, ms: Date.now() - started, ok: out.ok !== false, errorType: out.errorType, error: out.errorType ? String(out.error).slice(0, 300) : undefined, origin: entry.origin, depth });
  return out;
}

// Całe stdout jako JSON (także wielolinijkowy), w ostateczności ostatnia linia
function parseJson(stdout = '') {
  for (const candidate of [stdout.trim(), stdout.trim().split('\n').pop()]) {
    try {
      const v = JSON.parse(candidate);
      if (v && typeof v === 'object') return v;
    } catch {}
  }
  return null;
}

function outcome(r, timeout_ms) {
  if (r.error?.code === 'ETIMEDOUT') return fail('OUTCOME_UNKNOWN', `Timeout ${timeout_ms} ms — proces mógł częściowo się wykonać`);
  if (r.error) return fail('EXEC_ERROR', r.error.message);
  const parsed = parseJson(r.stdout);
  if (!parsed) {
    const errorType = r.status === 0 || r.status === 2 ? 'CONTRACT_ERROR' : 'EXEC_ERROR';
    return fail(errorType, (r.stderr || '').trim().slice(-800) || 'Wyjście procesu nie jest JSON', { exit: r.status });
  }
  if (r.status !== 0) return { ...parsed, ...fail('EXEC_ERROR', parsed.error || (r.stderr || '').trim().slice(-800) || `exit ${r.status}`, { exit: r.status }) };
  return parsed;
}
