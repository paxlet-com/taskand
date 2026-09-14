// taskand — testy integracyjne bez LLM: intencje, łańcuch przez rejestr, realne zachowanie procesów (anty-atrapy), guard
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseIntent } from '../generated/dev/chat/taskand.dev/v1/intent.mjs';
import { guard, contractTest } from '../generated/dev/evolve/taskand.dev/v1/contract.mjs';
import { digest, compareCounts } from '../generated/dev/evolve/taskand.dev/v1/gate.mjs';

let passed = 0;
let failed = 0;
function check(name, cond, detail = '') {
  if (cond) passed++;
  else failed++;
  console.log(`  ${cond ? '✓ PASS' : '✗ FAIL'}: ${name}${cond ? '' : ` ${String(detail).slice(0, 400)}`}`);
}

// Rejestr bez sekretów LLM: środowisko testu nie ma kluczy, a .env jest ukryty przez pusty TASKAND_LLM_API_KEY
const ENV = { PATH: process.env.PATH, HOME: process.env.HOME, TASKAND_LLM_API_KEY: '' };
function call(uri, input = {}, env = {}) {
  const r = spawnSync('node', ['generated/registry/core/taskand.dev/v1/bin.mjs'], {
    input: JSON.stringify({ action: 'call', uri, input }), encoding: 'utf8', timeout: 60000, env: { ...ENV, ...env }
  });
  try {
    return JSON.parse(r.stdout);
  } catch {
    return { ok: false, error: r.stderr };
  }
}
const P = name => `proc://taskand.dev/${name}/v1`;

console.log('=== Taskand Integration Test Suite ===\n');
const t0 = Date.now();

// 1. Tabela intencji i trasowanie organizmów
const cases = [
  ['sprawdź czy wszystko działa', '', 'diagnose'],
  ['czy plik /etc/hostname istnieje?', '', 'file-ops'],
  ['jaka jest temperatura komputera?', '', 'telemetry'],
  ['zbuduj monitoring z alertami', '', 'composite'],
  ['stwórz organizm admin, który sprawdzi dysk', '', 'spawn-organism'],
  ['zrób skrypt do backupu', '', 'evolve-create'],
  ['znajdź urządzenia w sieci', '', 'query'],
  ['cokolwiek', 'doc', 'diagnose'],
  ['znajdź urządzenia w sieci', 'admin', 'organism']
];
for (const [prompt, org, expected] of cases) {
  const got = parseIntent(prompt, org).name;
  check(`intencja ${org || 'dev'}: "${prompt}" → ${expected}`, got === expected, `(otrzymano ${got})`);
}

// 2. Łańcuch dev/chat → rejestr → proces
const diag = call(P('dev/chat'), { message: 'sprawdź czy wszystko działa' });
check('dev/chat → doctor/diagnose (realne sondy + rejestr)', diag.ok && /rejestr: \d+ procesów/.test(diag.reply), diag.reply || diag.error);
const file = call(P('dev/chat'), { message: 'czy plik /etc/hostname istnieje?' });
check('dev/chat → dev/file-router', file.ok && /ISTNIEJE/.test(file.reply), JSON.stringify(file));
// Sekrety pochodzą z brokera (.env) — zagnieżdżone wywołania nie dziedziczą env testu; nadpisanie działa tylko na 1. poziomie
const llm = call(P('dev/llm'), { prompt: 'x' });
check('dev/llm bez klucza → LLM_UNAVAILABLE (brak odpowiedzi zastępczej)', llm.ok === false && /LLM_UNAVAILABLE/.test(llm.error), JSON.stringify(llm));
const noEnv = call(P('file/ops'), { op: 'read', path: '/proc/self/environ' });
check('proces bez grantów nie widzi sekretów w swoim env', noEnv.ok && !/TASKAND_(LLM_API|VAULT)_KEY/.test(noEnv.content || ''), (noEnv.content || noEnv.error || '').slice(0, 200));

// 3. Anty-atrapy: wynik zależy od rzeczywistego stanu
const dir = mkdtempSync(join(tmpdir(), 'taskand-it-'));
writeFileSync(join(dir, 'probe.txt'), 'taskand-real-read');
const listing = call(P('file/ops'), { op: 'list', path: dir });
const read = call(P('file/ops'), { op: 'read', path: join(dir, 'probe.txt') });
check('file/ops list/read zwraca realną zawartość katalogu', listing.entries?.some(e => e.name === 'probe.txt') && read.content === 'taskand-real-read', JSON.stringify(read));
check('web/serve na zamkniętym porcie → ok:false', call(P('web/serve'), { port: 1 }).ok === false);
check('vault/secrets set bez klucza → ok:false', call(P('vault/secrets'), { action: 'set', name: 'x/y', value: 'z' }, { TASKAND_VAULT_KEY: '' }).ok === false);
const alert = call(P('alert/telegram'), { params: { threshold: 10, chat_id: '1' }, dependencies: { m: { cpu_pct: 99 } } });
check('alert/telegram powyżej progu bez poświadczenia → ok:false (brak fałszywego ALERT_DISPATCHED)', alert.ok === false && alert.triggered === true, JSON.stringify(alert));
check('browser/session bez CDP → ok:false', call(P('browser/session'), { action: 'status' }, { TASKAND_BROWSER_CDP: 'http://127.0.0.1:1' }).ok === false);
const cpu = call(P('monitor/cpu'));
check('monitor/cpu mierzy próbkę (sample_ms) zamiast średniej od startu', cpu.ok && cpu.sample_ms > 0 && typeof cpu.cpu_pct === 'number', JSON.stringify(cpu));
rmSync(dir, { recursive: true, force: true });

// 4. Guard ewolucji i test kontraktu
const header = '#!/usr/bin/env node\n';
check('guard odrzuca rm -rf', guard({ 'bin.mjs': `${header}execSync("rm -rf /tmp/x")` }).length > 0);
check('guard odrzuca import npm i import z innego pakietu', guard({ 'bin.mjs': `${header}import axios from 'axios';\nimport { x } from '../../y.mjs';` }).length === 2);
check('guard odrzuca odczyt .env / samomodyfikację', guard({ 'bin.mjs': `${header}readFileSync('.env')` }).length > 0 && guard({ 'bin.mjs': `${header}const p = 'generated/x';` }).length > 0);
check('guard odrzuca moduł > 180 linii', guard({ 'bin.mjs': header + 'x;\n'.repeat(200) }).some(v => /rozbij/.test(v)));
check('guard przepuszcza pakiet wielomodułowy node:* + ./moduł.mjs', guard({ 'bin.mjs': `${header}import os from 'node:os';\nimport { a } from './probe-a.mjs';`, 'probe-a.mjs': 'export const a = 1;' }).length === 0);
const tmp = mkdtempSync(join(tmpdir(), 'taskand-contract-'));
writeFileSync(join(tmp, 'good.mjs'), `${header}process.stdout.write(JSON.stringify({ ok: true, summary: 'x' }) + '\\n');`);
writeFileSync(join(tmp, 'bad.mjs'), `${header}process.stdout.write('hello');`);
check('contractTest akceptuje poprawny proces i odrzuca wyjście bez JSON', contractTest(join(tmp, 'good.mjs')).ok && !contractTest(join(tmp, 'bad.mjs')).ok);
rmSync(tmp, { recursive: true, force: true });

// 5. Samonaprawa: reguły recept (deterministyczne) i bramka regresji
const rx = call(P('doctor/prescribe'), { diagnosis: { healthy: false, findings: [
  { code: 'PROCESS_FAILING', severity: 'error', subject: 'proc://taskand.dev/lab/x/v1', origin: 'evolved', lastError: 'TypeError' },
  { code: 'PACKAGE_TAMPERED', severity: 'error', subject: 'proc://taskand.dev/lab/y/v2', origin: 'peer:rpi5' },
  { code: 'PACKAGE_TAMPERED', severity: 'error', subject: 'proc://taskand.dev/hw/monitor/v1', origin: 'builtin' },
  { code: 'SERVICE_DOWN', severity: 'error', subject: 'landing' }
] } });
const [failing, tamperedPeer, tamperedBuiltin, down] = rx.prescriptions || [];
check('recepta: zawodzący proces evolved → organizm (dev/evolve supersedes + opis błędu)',
  failing?.executor === 'organism' && failing.remedies[0].input.supersedes === 'proc://taskand.dev/lab/x/v1' && failing.remedies[0].input.failure === 'TypeError', JSON.stringify(failing));
check('recepta: zmieniony pakiet peer → kwarantanna (deprecate) + nowa wersja',
  tamperedPeer?.executor === 'organism' && tamperedPeer.remedies.map(r => r.input.action || 'evolve').join() === 'deprecate,evolve', JSON.stringify(tamperedPeer));
check('recepta: zmieniony pakiet builtin / usługa Docker → człowiek (brak samomodyfikacji i dostępu do Dockera)',
  tamperedBuiltin?.executor === 'human' && down?.executor === 'human', JSON.stringify([tamperedBuiltin, down]));
const heal = call(P('doctor/heal'), {});
check('doctor/heal bez {"run": true} tylko planuje', heal.mode === 'plan' && (heal.executed || []).length === 0, JSON.stringify(heal).slice(0, 300));
const dg = digest({ ok: true, summary: 's', devices: Array.from({ length: 40 }, (_, i) => ({ ip: `10.0.0.${i}` })), meta: { networks: [1, 2] } });
check('bramka regresji: skrót zawiera pełne liczności tablic zamiast obciętego JSON', dg.counts.devices === 40 && dg.counts['meta.networks'] === 2 && dg.samples.devices.length === 5);

// Deterministyczna część bramki: regresja liczności wychwytywana bez LLM
const dev = n => ({ ok: true, devices: Array.from({ length: n }, (_, i) => ({ ip: `10.0.0.${i}` })) });
check('bramka: mniej elementów niż poprzednia wersja → worse bez udziału LLM',
  compareCounts(dev(8), dev(1))?.verdict === 'worse', JSON.stringify(compareCounts(dev(8), dev(1))));
check('bramka: więcej elementów → better bez udziału LLM', compareCounts(dev(1), dev(8))?.verdict === 'better');
check('bramka: zniknięcie całej tablicy liczone jako 0 → worse', compareCounts(dev(3), { ok: true })?.verdict === 'worse');
check('bramka: równe liczności → null (o jakości rozstrzyga dopiero LLM)', compareCounts(dev(5), dev(5)) === null);

// 6. Powoływanie węzłów (occupy) — replikacja operatorska, nie autonomiczna
const manifest = readFileSync('bin/bootstrap.manifest', 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
const openFiles = manifest.filter(l => !l.startsWith('@secret ')).map(l => l);
const secretFiles = manifest.filter(l => l.startsWith('@secret ')).map(l => l.slice(8).trim());
check('manifest węzła: każda niesekretna ścieżka istnieje na dysku', openFiles.every(p => existsSync(p)), openFiles.filter(p => !existsSync(p)).join(', '));
check('manifest węzła: .env i vault są oznaczone @secret (nie kopiowane domyślnie)', secretFiles.includes('.env') && secretFiles.includes('vault') && !openFiles.includes('.env') && !openFiles.includes('vault'));

const occupy = (extra = []) => {
  const r = spawnSync('node', ['bin/taskand', 'occupy', 'deployer@test-node.local', '--json', ...extra], { encoding: 'utf8', timeout: 30000, env: { ...ENV, TASKAND_GATEWAY: 'http://127.0.0.1:1' } });
  try { return JSON.parse(r.stdout); } catch { return { ok: false, error: r.stderr }; }
};
const dry = occupy();
const planStr = JSON.stringify(dry.plan || []);
check('occupy: domyślnie dry-run (żadnego SSH nie wykonuje)', dry.ok === true && dry.mode === 'dry-run', JSON.stringify(dry).slice(0, 200));
check('occupy: plan zawiera rsync + docker compose up', /rsync\b/.test(planStr) && /docker compose up/.test(planStr));
check('occupy: bez --with-secrets plan NIE kopiuje .env ani vault', !(dry.files || []).includes('.env') && !(dry.files || []).includes('vault') && dry.secrets === false);
check('occupy: bez --token handshake pominięty; z --token krok pull mastera obecny', dry.handshake === false && occupy(['--token', 'T']).post.some(p => /node bin\/taskand pull /.test(p)));
check('occupy: --with-secrets dołącza .env i vault', occupy(['--with-secrets']).files.includes('.env'));

// 7. Peery: dopisz/usuń przez rejestr, stan genome netto bez zmian
const regAct = (action, payload = {}) => { const r = spawnSync('node', ['generated/registry/core/taskand.dev/v1/bin.mjs'], { input: JSON.stringify({ action, ...payload }), encoding: 'utf8', env: ENV }); try { return JSON.parse(r.stdout); } catch { return { ok: false }; } };
const peers0 = (regAct('peers').peers || []).slice().sort();
const TESTPEER = 'http://occupy-test.invalid:8077';
regAct('peer_add', { url: TESTPEER });
const withTest = regAct('peers').peers || [];
regAct('peer_remove', { url: TESTPEER });
const peers1 = (regAct('peers').peers || []).slice().sort();
check('peer add/remove: dopisany peer pojawia się i znika, genome netto bez zmian', withTest.includes(TESTPEER) && JSON.stringify(peers0) === JSON.stringify(peers1), JSON.stringify({ peers0, peers1 }));

const ms = Date.now() - t0;
check(`czas całości < 20 s (${ms} ms)`, ms < 20000);
console.log(`\nWynik testów integracyjnych: ${passed}/${passed + failed} PASS ${failed ? '✗' : '✓'}`);
process.exit(failed ? 1 : 0);
