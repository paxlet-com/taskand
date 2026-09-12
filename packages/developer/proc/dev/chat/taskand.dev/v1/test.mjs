import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));

const bad = spawnSync('node', [join(dir, 'bin.mjs')], { input: '{bad json' });
if (bad.status !== 2) {
  console.error('Test 1 failed: oczekiwano exit 2');
  process.exit(1);
}

const good = spawnSync('node', [join(dir, 'bin.mjs')], { input: JSON.stringify({ message: "dozbrój nginx na :8090" }) });
if (good.status !== 0) {
  console.error('Test 2 failed: oczekiwano exit 0', good.stderr);
  process.exit(1);
}
const out = JSON.parse(good.stdout);
if (!out.ok || !out.reply || out.intent !== "arm-service") {
  console.error('Test 2 failed: niepoprawna odpowiedź chat', out);
  process.exit(1);
}

const testFile = spawnSync('node', [join(dir, 'bin.mjs')], { input: JSON.stringify({ message: "stworz plik test-dev.txt w folderze /tmp o tresci witaj" }) });
if (testFile.status !== 0) {
  console.error('Test 3 failed: status !== 0', testFile.stderr);
  process.exit(1);
}
const out3 = JSON.parse(testFile.stdout);
if (!out3.ok || out3.intent !== "file-create") {
  console.error('Test 3 failed: intent !== file-create', out3);
  process.exit(1);
}

console.log('proc://taskand.dev/dev/chat/v1: kontrakt ✓');
