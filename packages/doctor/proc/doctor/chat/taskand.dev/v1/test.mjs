import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));

const bad = spawnSync('node', [join(dir, 'bin.mjs')], { input: '{bad json' });
if (bad.status !== 2) {
  console.error('Test 1 failed: oczekiwano exit 2');
  process.exit(1);
}

const good = spawnSync('node', [join(dir, 'bin.mjs')], { input: JSON.stringify({ message: "sprawdź czy wszystko działa" }) });
if (good.status !== 0) {
  console.error('Test 2 failed: oczekiwano exit 0', good.stderr);
  process.exit(1);
}
const out = JSON.parse(good.stdout);
if (!out.ok || !out.reply || out.intent !== "full-diagnose") {
  console.error('Test 2 failed: niepoprawna odpowiedź chat', out);
  process.exit(1);
}

console.log('proc://taskand.dev/doctor/chat/v1: kontrakt ✓');
