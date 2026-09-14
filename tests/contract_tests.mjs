// Testy kontraktu: każdy aktywny proces z rejestru wywołany przez registry/core z "{}" zwraca JSON z polem ok (boolean)
import { spawnSync } from 'node:child_process';

const REGISTRY = 'generated/registry/core/taskand.dev/v1/bin.mjs';
const ENV = { PATH: process.env.PATH, HOME: process.env.HOME, TASKAND_LLM_API_KEY: '' };
const registry = (action, payload = {}) =>
  JSON.parse(spawnSync('node', [REGISTRY], { input: JSON.stringify({ action, ...payload }), encoding: 'utf8', timeout: 90000, env: ENV }).stdout);

console.log('=== Weryfikacja kontraktów procesów (przez rejestr) ===');
const active = registry('list', { status: 'active' }).processes;
let passed = 0;
for (const { uri } of active) {
  const out = registry('call', { uri, input: {} });
  const ok = typeof out.ok === 'boolean' && !out.errorType;
  if (ok) passed++;
  console.log(`  ${uri}: ${ok ? 'PASS ✓' : `FAIL ✗ ${out.errorType || ''} ${out.error || 'brak pola ok'}`}`);
}
console.log(`Wynik kontraktów: ${passed}/${active.length} PASS ${passed === active.length ? '✓' : '✗'}`);
process.exit(passed === active.length ? 0 : 1);
