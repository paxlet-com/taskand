import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));

// Test 1: Błędny JSON -> exit 2
const bad = spawnSync('node', [join(dir, 'bin.mjs')], { input: '{bad json' });
if (bad.status !== 2) {
  console.error('Test 1 failed: oczekiwano exit 2');
  process.exit(1);
}

// Test 2: Poprawne wejście z mockiem -> exit 0
const mockPayload = {
  mockResults: [
    { target: "web-landing", ok: true, status: 200 },
    { target: "gateway-api", ok: true, status: 200 }
  ]
};
const good = spawnSync('node', [join(dir, 'bin.mjs')], { input: JSON.stringify(mockPayload) });
if (good.status !== 0) {
  console.error('Test 2 failed: oczekiwano exit 0', good.stderr);
  process.exit(1);
}

const out = JSON.parse(good.stdout);
if (!out.ok || !out.healthy || out.issues.length !== 0) {
  console.error('Test 2 failed: niepoprawna struktura wyniku zdrowia', out);
  process.exit(1);
}

console.log('proc://taskand.dev/doctor/diagnose/v1: kontrakt ✓');
