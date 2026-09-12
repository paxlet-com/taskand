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

// Test 2: Generowanie recepty przy wykrytej awarii WWW
const payload = {
  issues: [
    { target: "web-landing", status: "DOWN", error: "Connection refused :8090", severity: "CRITICAL" }
  ]
};
const good = spawnSync('node', [join(dir, 'bin.mjs')], { input: JSON.stringify(payload) });
if (good.status !== 0) {
  console.error('Test 2 failed: oczekiwano exit 0', good.stderr);
  process.exit(1);
}

const out = JSON.parse(good.stdout);
if (!out.ok || !out.actionsRequired || out.prescriptions.length !== 1) {
  console.error('Test 2 failed: brak recepty', out);
  process.exit(1);
}
if (out.prescriptions[0].delegateTo !== "capsule:taskand-developer") {
  console.error('Test 2 failed: zła delegacja', out);
  process.exit(1);
}

console.log('proc://taskand.dev/doctor/prescribe/v1: kontrakt ✓');
