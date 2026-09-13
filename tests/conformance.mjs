// Konformacja węzła: integralność rejestru, brak niezarejestrowanych pakietów, pakiety samodzielne, genom zgodny z rejestrem
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const registry = (action, payload = {}) =>
  JSON.parse(spawnSync('node', ['generated/registry/core/taskand.dev/v1/bin.mjs'], { input: JSON.stringify({ action, ...payload }), encoding: 'utf8' }).stdout);

const checks = [];
const check = (name, ok, detail) => checks.push({ name, ok, detail });

const verify = registry('verify');
check('bindingHash wszystkich aktywnych pakietów', verify.ok, verify.broken?.join(', '));
const scan = registry('scan');
check('każdy pakiet na dysku jest w rejestrze organizmu', scan.unregistered.length === 0, scan.unregistered.join(', '));
const active = registry('list', { status: 'active' }).processes;
const genome = readFileSync('genome.yaml', 'utf8');
const missing = active.filter(p => !genome.includes(p.uri)).map(p => p.uri);
check('genome.yaml zawiera wszystkie aktywne procesy', missing.length === 0, missing.join(', '));
const shared = spawnSync('grep', ['-rln', '--include=*.mjs', '-E', "from ['\"]\\.\\./", 'generated'], { encoding: 'utf8' }).stdout.trim();
check('brak importów spoza pakietu (../)', shared === '', shared);

console.log('=== Konformacja węzła taskand ===');
for (const c of checks) console.log(`  ${c.ok ? '✓' : '✗'} ${c.name}${c.ok ? '' : `: ${c.detail}`}`);
const failed = checks.filter(c => !c.ok).length;
console.log(`Wynik konformacji: ${checks.length - failed}/${checks.length} ${failed ? '✗' : '✓'}`);
process.exit(failed ? 1 : 0);
