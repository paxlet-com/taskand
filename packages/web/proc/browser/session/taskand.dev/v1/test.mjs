import { spawnSync } from 'node:child_process';

// Test 1: start sesji
const r1 = spawnSync('node', ['proc/browser/session/taskand.dev/v1/bin.mjs'], {
  input: JSON.stringify({ action: 'start', headless: true })
});
if (r1.status !== 0) {
  console.error('Test 1 fail:', r1.stderr.toString());
  process.exit(1);
}
const res1 = JSON.parse(r1.stdout.toString());
if (!res1.sessionId || !res1.sessionId.startsWith('session://browser/')) {
  console.error('Test 1 invalid output:', res1);
  process.exit(1);
}

// Test 2: open URL
const r2 = spawnSync('node', ['proc/browser/session/taskand.dev/v1/bin.mjs'], {
  input: JSON.stringify({ action: 'open', url: 'https://example.com' })
});
if (r2.status !== 0) {
  console.error('Test 2 fail:', r2.stderr.toString());
  process.exit(1);
}
const res2 = JSON.parse(r2.stdout.toString());
if (!res2.opened || res2.status !== 'loaded') {
  console.error('Test 2 invalid output:', res2);
  process.exit(1);
}

// Test 3: screenshot
const r3 = spawnSync('node', ['proc/browser/session/taskand.dev/v1/bin.mjs'], {
  input: JSON.stringify({ action: 'screenshot' })
});
if (r3.status !== 0) {
  console.error('Test 3 fail:', r3.stderr.toString());
  process.exit(1);
}
const res3 = JSON.parse(r3.stdout.toString());
if (!res3.screenshot || !res3.screenshot.startsWith('artifact:screenshot-')) {
  console.error('Test 3 invalid output:', res3);
  process.exit(1);
}

// Test 4: stop sesji
const r4 = spawnSync('node', ['proc/browser/session/taskand.dev/v1/bin.mjs'], {
  input: JSON.stringify({ action: 'stop', sessionId: res1.sessionId })
});
if (r4.status !== 0) {
  console.error('Test 4 fail:', r4.stderr.toString());
  process.exit(1);
}

// Test 5: fail-closed na pustym wejściu (exit 2)
const r5 = spawnSync('node', ['proc/browser/session/taskand.dev/v1/bin.mjs'], { input: '' });
if (r5.status !== 2) {
  console.error('Test 5 fail: oczekiwano exit 2, otrzymano', r5.status);
  process.exit(1);
}

console.log('proc://taskand.dev/browser/session/v1: testy kontraktu ✓ (fail-closed zachowany)');
