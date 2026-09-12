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

// Test 2: Pobranie sekretu purpose-scoped dla developera -> exit 0
const getReq = { action: "get", consumer: "developer", purpose: "codegen" };
const good = spawnSync('node', [join(dir, 'bin.mjs')], { input: JSON.stringify(getReq) });
if (good.status !== 0) {
  console.error('Test 2 failed: oczekiwano exit 0', good.stderr);
  process.exit(1);
}
const out = JSON.parse(good.stdout);
if (!out.ok || !out.accessGranted) {
  console.error('Test 2 failed: brak accessGranted');
  process.exit(1);
}

// Test 3: Nieuprawniony dostęp -> exit 1 (DENY)
const badReq = { action: "get", consumer: "unknown-actor", purpose: "leak" };
const denied = spawnSync('node', [join(dir, 'bin.mjs')], { input: JSON.stringify(badReq) });
if (denied.status !== 1) {
  console.error('Test 3 failed: oczekiwano exit 1 przy odmowie');
  process.exit(1);
}

console.log('proc://taskand.dev/vault/secrets/v1: kontrakt ✓');
