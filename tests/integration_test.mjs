// taskand v2.2 — testy integracyjne bez LLM: intencje, dispatch, guard/kontrakt ewolucji, integralność katalogu
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseIntent } from '../generated/dev/chat/taskand.dev/v1/intent.mjs';
import { guard, contractTest } from '../generated/dev/evolve/taskand.dev/v1/contract.mjs';
import { callProc } from '../generated/_lib/proc.mjs';
import { loadCatalog, resolveUri } from '../generated/_lib/catalog.mjs';

let passed = 0;
let failed = 0;
function check(name, cond, detail = '') {
  if (cond) passed++;
  else failed++;
  console.log(`  ${cond ? '✓ PASS' : '✗ FAIL'}: ${name}${cond ? '' : ` ${detail}`}`);
}

console.log('=== Taskand v2.2 Integration Test Suite ===\n');

const t0 = Date.now();
const NO_LLM = { PATH: process.env.PATH, HOME: process.env.HOME };

// 1. Tabela intencji
const cases = [
  ['sprawdź czy wszystko działa', 'diagnose'],
  ['czy plik /etc/hostname istnieje?', 'file-ops'],
  ['jaka jest temperatura komputera?', 'telemetry'],
  ['zbuduj monitoring z alertami', 'composite'],
  ['stwórz organizm admin, który sprawdzi dysk', 'spawn-organism'],
  ['zrób skrypt do backupu', 'evolve-create'],
  ['znajdź urządzenia w sieci', 'query']
];
for (const [prompt, expected] of cases) {
  const got = parseIntent(prompt).name;
  check(`intencja "${prompt}" → ${expected}`, got === expected, `(otrzymano ${got})`);
}
const spawn = parseIntent('stworz organizm admin, ktory bedzie w stanie podać temperaturę');
check('spawn-organism wyciąga nazwę i zdolność', spawn.match[1] === 'admin' && /temperatur/.test(spawn.match[2]));

// 2. Łańcuch dev/chat → proces (bez LLM)
const file = callProc('proc://taskand.dev/dev/chat/v1', { message: 'czy plik /etc/hostname istnieje?' }, { env: NO_LLM });
check('dev/chat → dev/file-router', file.ok && file.intent === 'file-ops' && /ISTNIEJE/.test(file.reply), JSON.stringify(file));
const temp = callProc('proc://taskand.dev/dev/chat/v1', { message: 'jaka jest temperatura?' }, { env: NO_LLM });
check('dev/chat → hw/monitor bez zmyślonego statusu', temp.ok && !/wszystkie parametry w normie/.test(temp.reply), temp.reply);
const act = callProc('proc://taskand.dev/dev/act/v1', { message: 'znajdź urządzenia w sieci' }, { env: NO_LLM });
check('dev/act bez LLM zgłasza błąd zamiast udawać wykonanie', act.ok === false && /nie zostało wykonane/.test(act.reply), JSON.stringify(act));
const evolve = callProc('proc://taskand.dev/dev/evolve/v1', { organism: 'x', name: 'y', capability: 'z' }, { env: NO_LLM });
check('dev/evolve bez LLM → ok:false (brak fałszywego procesu)', evolve.ok === false && /LLM_UNAVAILABLE/.test(evolve.error), JSON.stringify(evolve));

// 3. Guard statyczny ewolucji
const header = '#!/usr/bin/env node\n';
check('guard odrzuca rm -rf', guard(`${header}execSync("rm -rf /tmp/x")`) !== null);
check('guard odrzuca import npm', guard(`${header}import axios from 'axios';`) !== null);
check('guard odrzuca odczyt sekretów', guard(`${header}process.env.TASKAND_LLM_API_KEY`) !== null);
check('guard przepuszcza czysty kod node:*', guard(`${header}import os from 'node:os';\nconsole.log(1);`) === null);

// 4. Test kontraktu ewolucji
const dir = mkdtempSync(join(tmpdir(), 'taskand-contract-'));
const good = join(dir, 'good.mjs');
const bad = join(dir, 'bad.mjs');
writeFileSync(good, `${header}process.stdout.write(JSON.stringify({ ok: true, summary: 'x' }) + '\\n');`);
writeFileSync(bad, `${header}process.stdout.write('hello');`);
check('contractTest akceptuje poprawny proces', contractTest(good).ok);
check('contractTest odrzuca wyjście bez JSON', !contractTest(bad).ok);
rmSync(dir, { recursive: true, force: true });

// 5. Integralność katalogu: każdy wpis rozwiązuje się z poprawnym bindingHash
const broken = loadCatalog().processes.map(p => resolveUri(p.uri)).filter(r => !r.ok);
check('proc-catalog.json: wszystkie bindingHash poprawne', broken.length === 0, broken.map(b => b.error).join('; '));

const ms = Date.now() - t0;
check(`czas całości < 5 s (${ms} ms)`, ms < 5000);

console.log(`\nWynik testów integracyjnych: ${passed}/${passed + failed} PASS ${failed ? '✗' : '✓'}`);
process.exit(failed ? 1 : 0);
