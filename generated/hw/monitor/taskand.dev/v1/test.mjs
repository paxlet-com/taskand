// Test kontraktu dla proc://taskand.dev/hw/monitor/v1
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const bin = join(dir, 'bin.mjs');

// Test 1: Puste wejście JSON -> kod 0 i prawidłowy JSON wyjściowy
const res1 = spawnSync('node', [bin], { input: '{}', encoding: 'utf8' });
if (res1.status !== 0) {
  console.error(`FAIL: Oczekiwano exit 0, otrzymano ${res1.status}. Stderr: ${res1.stderr}`);
  process.exit(1);
}
const out1 = JSON.parse(res1.stdout);
if (!out1.ok || !('cpu_usage_pct' in out1) || !('ts' in out1)) {
  console.error('FAIL: Wyjście JSON nie zawiera wymaganych pól ok, cpu_usage_pct, ts:', out1);
  process.exit(1);
}

// Test 2: Błędny JSON wejściowy -> kod 2 (błąd kontraktu)
const res2 = spawnSync('node', [bin], { input: '{niepoprawny_json}', encoding: 'utf8' });
if (res2.status !== 2) {
  console.error(`FAIL: Oczekiwano exit 2 dla błędnego wejścia, otrzymano ${res2.status}`);
  process.exit(1);
}

console.log('PASS: Wszystkie testy kontraktu proc://taskand.dev/hw/monitor/v1 zakończone sukcesem.');
process.exit(0);
