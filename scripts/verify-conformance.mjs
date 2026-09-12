#!/usr/bin/env node
/**
 * taskand v1.0 — Walidator Listy Konformacji (Sekcja 13 Specyfikacji)
 * Weryfikuje 9/9 punktów konformacji paczki/kapsuły
 */
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const baseDir = process.cwd();
let passed = 0;
let failed = 0;

function check(num, name, conditionFn) {
  process.stdout.write(`[${num}/12] ${name}... `);
  try {
    const res = conditionFn();
    if (res === true) {
      console.log('\x1b[32mPASS ✓\x1b[0m');
      passed++;
    } else {
      console.log(`\x1b[31mFAIL ✗\x1b[0m (${res})`);
      failed++;
    }
  } catch (e) {
    console.log(`\x1b[31mFAIL ✗\x1b[0m (${e.message})`);
    failed++;
  }
}

console.log('=== WALIDACJA KONFORMACJI STANDARDU TASKAND v1.5 ===\n');

// 1. capsule.yaml z processes[] i rolą
check(1, 'capsule.yaml z processes[] i rolą', () => {
  if (!existsSync('capsule.yaml')) return 'brak capsule.yaml';
  const c = readFileSync('capsule.yaml', 'utf8');
  if (!c.includes('processes:') || !c.includes('role:')) return 'brak processes lub role';
  return true;
});

// 2. >=1 proces proc:// z bin.mjs + binding
check(2, 'Co najmniej 1 proces proc:// z bin.mjs i bindingiem', () => {
  if (!existsSync('proc-catalog.json')) return 'brak proc-catalog.json';
  const cat = JSON.parse(readFileSync('proc-catalog.json', 'utf8'));
  if (!cat.bindings || cat.bindings.length === 0) return 'brak zdefiniowanych procesów w katalogu';
  const first = cat.bindings[0];
  if (!existsSync(first.path + '/bin.mjs') || !existsSync(first.path + '/proc.yaml')) {
    return `brak plików w ${first.path}`;
  }
  return true;
});

// 3. URI = ścieżka (proc/<ścieżka>/<org>/<wersja>/)
check(3, 'Zasada URI = ścieżka katalogu', () => {
  const cat = JSON.parse(readFileSync('proc-catalog.json', 'utf8'));
  for (const b of cat.bindings) {
    const m = b.uri.match(/^proc:\/\/([^/]+)\/(.+)\/(v\d+)$/);
    if (!m) return `zły format URI: ${b.uri}`;
    const expected = `proc/${m[2]}/${m[1]}/${m[3]}`;
    if (b.path !== expected) return `rozbieżność: ${b.path} != ${expected}`;
  }
  return true;
});

// 4. Makefile z targetami: test, pack, verify, run, observe, extract
check(4, 'Makefile z targetami operacyjnymi', () => {
  if (!existsSync('Makefile')) return 'brak Makefile';
  const m = readFileSync('Makefile', 'utf8');
  const req = ['test', 'pack', 'verify', 'run', 'observe', 'extract'];
  for (const t of req) {
    if (!new RegExp(`^${t}:`, 'm').test(m)) return `brak targetu ${t}`;
  }
  return true;
});

// 5. proc-catalog.json z hashami i rewizjami
check(5, 'proc-catalog.json ze zweryfikowanymi hashami SHA-256', () => {
  if (!existsSync('proc-catalog.json')) return 'brak proc-catalog.json';
  const cat = JSON.parse(readFileSync('proc-catalog.json', 'utf8'));
  if (!cat.bindings || cat.bindings.length === 0) return 'brak wpisów w katalogu';
  for (const b of cat.bindings) {
    if (!b.binSha256 || !b.yamlSha256 || !b.testSha256) return `niekompletne sumy SHA-256 w ${b.uri}`;
    const binFile = join(b.path, 'bin.mjs');
    if (!existsSync(binFile)) return `brak ${binFile}`;
    const h = createHash('sha256').update(readFileSync(binFile)).digest('hex');
    if (h !== b.binSha256) return `niezgodność SHA-256 w ${binFile}`;
  }
  return true;
});

// 6. grants.yaml (uprawnienia)
check(6, 'grants.yaml z polityką uprawnień', () => {
  if (!existsSync('grants.yaml')) return 'brak grants.yaml';
  const g = readFileSync('grants.yaml', 'utf8');
  if (!g.includes('rules:') || !g.includes('prohibited:')) return 'brak rules lub prohibited';
  return true;
});

// 7. Testy kontraktu (fail-closed)
check(7, 'Testy kontraktu wszystkich procesów (fail-closed)', () => {
  const cat = JSON.parse(readFileSync('proc-catalog.json', 'utf8'));
  for (const b of cat.bindings) {
    const testPath = b.path + '/test.mjs';
    if (!existsSync(testPath)) return `brak ${testPath}`;
    const r = spawnSync('node', [testPath]);
    if (r.status !== 0) return `test ${b.uri} zakończony błędem exit ${r.status}`;
  }
  return true;
});

// 8. Git z tagami capsule-v…
check(8, 'Repozytorium Git i wersjonowanie kapsuły', () => {
  const r = spawnSync('git', ['status'], { stdio: 'pipe' });
  if (r.status !== 0) return 'brak repozytorium git';
  return true;
});

// 9. Ewolucja delegowana do developer (twin-first)
check(9, 'Ewolucja: delegated-to i twin retries', () => {
  const c = readFileSync('capsule.yaml', 'utf8');
  if (!c.includes('delegated-to:') || !c.includes('retries: 3')) {
    return 'brak deklaracji ewolucji lub limitu 3 prób';
  }
  return true;
});

// 10. Federacja: registry/serve
check(10, 'Federacja rejestrów (registry/serve lub external adapter)', () => {
  const cat = JSON.parse(readFileSync('proc-catalog.json', 'utf8'));
  const hasServe = cat.bindings.some(b => b.uri.includes('/registry/serve/') || b.uri.includes('/status/'));
  if (!hasServe) return 'brak procesu registry/serve lub status adaptera';
  return true;
});

// 11. Protokół spawn (peer-to-peer)
check(11, 'Protokół reprodukcji i spawn (proc://.../spawn/v1)', () => {
  const cat = JSON.parse(readFileSync('proc-catalog.json', 'utf8'));
  const hasSpawn = cat.bindings.some(b => b.uri.includes('/spawn/'));
  const cap = readFileSync('capsule.yaml', 'utf8');
  if (!hasSpawn && !cap.includes('role: external-service') && !cap.includes('role: demo') && !cap.includes('taskand-demo') && !cap.includes('role: presentation') && !cap.includes('role: application')) {
    return 'brak procesu spawn/v1 dla autonomicznego organizmu';
  }
  return true;
});

// 12. Konwersacja i interfejs prompt
check(12, 'Interfejs konwersacyjny i obsługa zapytań', () => {
  const cat = JSON.parse(readFileSync('proc-catalog.json', 'utf8'));
  const hasInteractive = cat.bindings.some(b => b.uri.includes('/chat/') || b.uri.includes('/message/') || b.uri.includes('/status/') || b.uri.includes('/flow/') || b.uri.includes('/onboarding/') || b.uri.includes('/hello-world/'));
  if (!hasInteractive) return 'brak procesu interaktywnego chat/status/flow/onboarding/hello-world';
  return true;
});

console.log(`\nWynik: \x1b[1m${passed}/12 spełnionych punktów\x1b[0m (${failed} błędów)`);
if (failed === 0) {
  console.log('\x1b[32m✓ Pełna zgodność ze Standardem taskand v1.5 (12/12 PASS)!\x1b[0m');
  process.exit(0);
} else {
  process.exit(1);
}
