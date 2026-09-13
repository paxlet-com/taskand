#!/usr/bin/env node
// tests/negative_tests.mjs — testy negatywne: walidator, orkiestrator, rejestr (integralność, konformacja, cykl życia), gateway
import { spawnSync } from 'node:child_process';
import { writeFileSync, unlinkSync, mkdirSync, rmSync, readFileSync, appendFileSync } from 'node:fs';

let passed = 0;
let failed = 0;
function assert(condition, message, detail = '') {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message} ${detail}`);
    failed++;
  }
}

const node = (bin, input) => {
  const r = spawnSync('node', [bin], { input: JSON.stringify(input), encoding: 'utf8', timeout: 120000 });
  return JSON.parse(r.stdout);
};
const REGISTRY = 'generated/registry/core/taskand.dev/v1/bin.mjs';
const VALIDATOR = 'generated/validator/resolve/taskand.dev/v1/bin.mjs';
const ORCHESTRATOR = 'generated/orchestrator/execute/taskand.dev/v1/bin.mjs';
const registry = (action, payload = {}) => node(REGISTRY, { action, ...payload });
const MSG = 'proc://taskand.dev/chat/message/v1';

console.log('=== Taskand Negative Test Suite ===\n');

// 1–4: walidator
{
  const res = node(VALIDATOR, { steps: [{ id: 1, name: 'stepA', process: MSG, deps: ['stepB'] }, { id: 2, name: 'stepB', process: MSG, deps: ['stepA'] }] });
  assert(res.valid === false && res.status === 'REJECTED', '1. Detekcja cyklu w grafie (A -> B -> A) odrzuca plan');
}
{
  const res = node(VALIDATOR, { steps: [{ id: 1, name: 'stepA', process: MSG, deps: [] }, { id: 1, name: 'stepB', process: MSG, deps: [] }] });
  assert(res.valid === false && res.errors?.some(e => e.includes('Zduplikowane id')), '2. Zduplikowane id kroku odrzuca plan');
}
{
  const res = node(VALIDATOR, { steps: [{ id: 1, name: 'stepA', process: MSG, deps: [], params: { bot_token: 'secret123' } }] });
  assert(res.valid === false && res.errors?.some(e => e.includes('Niedozwolony jawny sekret')), '3. Jawny token bez vault:// odrzuca plan');
}
{
  const res = node(VALIDATOR, { steps: [{ id: 1, name: 'stepA', process: 'proc://taskand.dev/../../etc/passwd', deps: [] }] });
  assert(res.valid === false && res.errors?.some(e => e.includes('Proces URI nieznany')), '4. Path traversal / nieznany proces URI odrzuca plan');
}

// 5–7: orkiestrator (kroki wykonywane wyłącznie przez rejestr)
{
  const res = node(ORCHESTRATOR, { steps: [
    { id: 1, name: 'failStep', process: 'proc://unknown', resolvedPath: 'generated/chat/message/taskand.dev/v1/bin.mjs', deps: [] },
    { id: 2, name: 'depStep', process: MSG, deps: ['failStep'] }
  ] });
  assert(res.status === 'FAILED' && res.steps.failStep?.errorType === 'NOT_FOUND' && res.steps.depStep?.status === 'BLOCKED',
    '5. Nieznany URI → FAILED mimo podanego resolvedPath; krok zależny BLOCKED');
}
{
  const res = node(ORCHESTRATOR, { steps: [{ id: 1, name: 'contract', process: 'proc://taskand.dev/dev/evolve/v1', deps: [] }] });
  assert(res.steps.contract?.status === 'FAILED' && res.steps.contract?.errorType === 'VALIDATION_FAILED', '6. Proces z exit 0, ale ok:false → FAILED (VALIDATION_FAILED)');
}
{
  const runId = `test-crash-${Date.now()}`;
  const statePath = `log/orchestrations/${runId}.json`;
  mkdirSync('log/orchestrations', { recursive: true });
  writeFileSync(statePath, JSON.stringify({ runId, status: 'RUNNING', steps: { step1: { id: 1, name: 'step1', status: 'SUCCEEDED', output: { cpu_pct: 1 } } } }));
  const res = node(ORCHESTRATOR, { runId, steps: [
    { id: 1, name: 'step1', process: 'proc://taskand.dev/must/not-run/v1', deps: [] },
    { id: 2, name: 'step2', process: 'proc://taskand.dev/monitor/cpu/v1', deps: ['step1'] }
  ] });
  assert(res.steps.step1?.status === 'SUCCEEDED' && res.steps.step2?.status === 'SUCCEEDED', '7. Resume po awarii: krok SUCCEEDED nie został powtórzony');
  try { unlinkSync(statePath); } catch {}
}

// 11–15: rejestr — tymczasowy organizm ztest (sprzątany, genome.yaml przywracany)
{
  const genome = readFileSync('genome.yaml', 'utf8');
  const dir = 'generated/ztest/probe/taskand.dev/v1';
  const uri = 'proc://taskand.dev/ztest/probe/v1';
  const write = (bin, extra = {}) => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/proc.yaml`, `uri: ${uri}\norganism: ztest\nkind: task\norigin: builtin\ndesc: "test"\n`);
    writeFileSync(`${dir}/bin.mjs`, bin);
    for (const [f, c] of Object.entries(extra)) writeFileSync(`${dir}/${f}`, c);
  };
  const OK_BIN = "#!/usr/bin/env node\nprocess.stdout.write(JSON.stringify({ ok: true, env: Object.keys(process.env) }) + '\\n');\n";
  try {
    write("#!/usr/bin/env node\nimport { call } from '../../../../dev/act/taskand.dev/v1/registry-client.mjs';\n");
    const bad = registry('register', { uri });
    assert(bad.ok === false && /spoza pakietu/.test(bad.error), '11. Import z innego pakietu → rejestracja odrzucona (pakiet = osobny byt)', bad.error);

    rmSync('generated/ztest', { recursive: true, force: true });
    write(OK_BIN);
    const cand = registry('register', { uri, origin: 'peer:test-node' });
    const denied = registry('call', { uri });
    assert(cand.entry?.status === 'candidate' && denied.errorType === 'DENIED', '12. Pakiet od peera = candidate i nie jest wykonywany przed approve');

    const approved = registry('approve', { uri });
    const run = registry('call', { uri });
    assert(approved.ok && run.ok && !run.env.includes('TASKAND_LLM_API_KEY') && !run.env.includes('TASKAND_VAULT_KEY'),
      '13. Po approve wykonanie z izolowanym env (bez sekretów niezadeklarowanych w proc.yaml)', JSON.stringify(run));

    appendFileSync(`${dir}/bin.mjs`, '// tamper\n');
    const tampered = registry('call', { uri });
    assert(tampered.errorType === 'DENIED' && /bindingHash/.test(tampered.error), '14. Zmiana pliku pakietu po rejestracji → wywołanie odrzucone (bindingHash)');

    const reRegister = registry('register', { uri });
    assert(reRegister.ok === false && /niezmienne/.test(reRegister.error), '15. Ponowna rejestracja zmienionej wersji odrzucona (wersje niezmienne)');
  } finally {
    rmSync('generated/ztest', { recursive: true, force: true });
    writeFileSync('genome.yaml', genome);
  }
}

// 8–10, 16: gateway — auth i granty
{
  const curl = (path, token, body) => spawnSync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', '-X', 'POST', `http://127.0.0.1:8077${path}`, '-H', 'Content-Type: application/json',
    ...(token ? ['-H', `Authorization: Bearer ${token}`] : []), '-d', JSON.stringify(body)], { encoding: 'utf8' }).stdout.trim();
  const HW = { uri: 'proc://taskand.dev/hw/monitor/v1' };
  assert(curl('/api/proc/call', null, HW) === '401', '8. Wywołanie proc/call bez nagłówka auth zwraca 401 Unauthorized');
  assert(curl('/api/proc/call', 'taskand-guest-key', { uri: 'proc://taskand.dev/file/ops/v1' }) === '403', '9. Wywołanie proc/call z tokenem guest do zasobu file/ops zwraca 403 Forbidden');
  assert(curl('/api/proc/call', 'taskand-admin-key', HW) === '200', '10. Wywołanie proc/call z tokenem admin zwraca 200 OK');
  assert(curl('/api/chat', null, { message: 'zrób skrypt' }) === '401' && curl('/api/chat', 'taskand-guest-key', { message: 'zrób skrypt' }) === '403',
    '16. /api/chat (wykonanie + ewolucja) wymaga tokenu z grantem do dev/chat');
  assert(curl('/api/registry', 'taskand-operator-key', { action: 'approve', uri: MSG }) === '403', '17. approve w rejestrze wymaga uprawnień admin');
}

console.log(`\nWynik testów negatywnych: ${passed}/${passed + failed} PASS ${failed ? '✗' : '✓'}`);
if (failed > 0) process.exit(1);
