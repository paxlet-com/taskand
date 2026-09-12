import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));

// Test 1: Błędne wejście -> exit 2
const bad = spawnSync('node', [join(dir, 'bin.mjs')], { input: 'invalid json' });
if (bad.status !== 2) {
  console.error('Test 1 failed: oczekiwano exit 2 przy złym JSON');
  process.exit(1);
}

// Test 2: Poprawne wejście -> exit 0
const good = spawnSync('node', [join(dir, 'bin.mjs')], { input: JSON.stringify({ task: "napraw błąd portu" }) });
if (good.status !== 0) {
  console.error('Test 2 failed: oczekiwano exit 0');
  process.exit(1);
}

const res = JSON.parse(good.stdout);
if (!res.ok || !res.steps) {
  console.error('Test 2 failed: niepoprawna struktura odpowiedzi');
  process.exit(1);
}

console.log('proc://taskand.dev/dev/plan/v1: kontrakt ✓');
