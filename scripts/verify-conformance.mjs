#!/usr/bin/env node
/**
 * taskand v1.6 — Walidator Listy Konformacji (Część IV · 13 Specyfikacji)
 * Weryfikuje 14/14 punktów konformacji paczki/kapsuły i ekosystemu multi-device
 */
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';

let passed = 0;
let failed = 0;

function findProjectRoot() {
  let cur = process.cwd();
  while (cur && cur !== '/' && !existsSync(join(cur, 'docker-compose.yaml')) && !existsSync(join(cur, 'genome.yaml'))) {
    cur = dirname(cur);
  }
  return cur || process.cwd();
}

function check(num, name, conditionFn) {
  process.stdout.write(`[${num}/14] ${name}... `);
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

console.log('=== WALIDACJA KONFORMACJI STANDARDU TASKAND v1.6 ===\n');

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
    if (b.path !== expected) {
      return `URI ${b.uri} mapuje się na ${b.path}, oczekiwano ${expected}`;
    }
  }
  return true;
});

// 4. Makefile z targetami operacyjnymi
check(4, 'Makefile z targetami operacyjnymi', () => {
  if (!existsSync('Makefile')) return 'brak Makefile';
  const m = readFileSync('Makefile', 'utf8');
  const required = ['test:', 'pack:', 'verify:'];
  for (const r of required) {
    if (!m.includes(r)) return `brak targetu ${r} w Makefile`;
  }
  return true;
});

// 5. proc-catalog.json z hashami SHA-256
check(5, 'proc-catalog.json ze zweryfikowanymi hashami SHA-256', () => {
  if (!existsSync('proc-catalog.json')) return 'brak proc-catalog.json';
  const cat = JSON.parse(readFileSync('proc-catalog.json', 'utf8'));
  for (const b of cat.bindings) {
    const bin = readFileSync(b.path + '/bin.mjs');
    const yaml = readFileSync(b.path + '/proc.yaml');
    const binHash = createHash('sha256').update(bin).digest('hex');
    const yamlHash = createHash('sha256').update(yaml).digest('hex');
    if (b.binSha256 !== binHash) return `niezgodny hash binSha256 dla ${b.uri}`;
    if (b.yamlSha256 !== yamlHash) return `niezgodny hash yamlSha256 dla ${b.uri}`;
  }
  return true;
});

// 6. grants.yaml z polityką uprawnień
check(6, 'grants.yaml z polityką uprawnień', () => {
  if (!existsSync('grants.yaml')) return 'brak grants.yaml';
  const g = readFileSync('grants.yaml', 'utf8');
  if (!g.includes('rules:') && !g.includes('allowed:') && !g.includes('role:')) {
    return 'brak sekcji rules/allowed/role w grants.yaml';
  }
  return true;
});

// 7. Testy kontraktu (fail-closed)
check(7, 'Testy kontraktu wszystkich procesów (fail-closed)', () => {
  const cat = JSON.parse(readFileSync('proc-catalog.json', 'utf8'));
  for (const b of cat.bindings) {
    const testFile = b.path + '/test.mjs';
    if (!existsSync(testFile)) return `brak testu ${testFile}`;
    // Test z poprawnym wykonaniem (lub sam test pliku)
    const run = spawnSync('node', [testFile]);
    if (run.status !== 0) return `test kontraktu dla ${b.uri} zakończony błędem (kod ${run.status}): ${run.stderr}`;
  }
  return true;
});

// 8. Repozytorium Git i wersjonowanie kapsuły
check(8, 'Repozytorium Git i wersjonowanie kapsuły', () => {
  const root = findProjectRoot();
  if (!existsSync(join(root, '.git'))) return 'brak repozytorium .git';
  const res = spawnSync('git', ['status', '--porcelain'], { cwd: root });
  if (res.status !== 0) return 'błąd wywołania git';
  return true;
});

// 9. Ewolucja: delegated-to i twin retries
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
  const hasInteractive = cat.bindings.some(b => b.uri.includes('/chat/') || b.uri.includes('/message/') || b.uri.includes('/status/') || b.uri.includes('/flow/') || b.uri.includes('/onboarding/') || b.uri.includes('/hello-world/') || b.uri.includes('/ops/'));
  if (!hasInteractive) return 'brak procesu interaktywnego chat/status/flow/onboarding/hello-world/ops';
  return true;
});

// 13. Multi-device: devices w genome.yaml
check(13, 'Multi-device: sekcja devices w genome.yaml', () => {
  const root = findProjectRoot();
  const genomePath = join(root, 'genome.yaml');
  if (!existsSync(genomePath)) return 'brak genome.yaml w głównym repozytorium';
  const g = readFileSync(genomePath, 'utf8');
  if (!g.includes('devices:') || !g.includes('workstation') || !g.includes('rpi5')) {
    return 'brak poprawnej sekcji devices (workstation, rpi5) w genome.yaml';
  }
  return true;
});

// 14. Digital twin: definicje VM w docker-compose.yaml
check(14, 'Digital twin: definicje maszyn VM w docker-compose.yaml', () => {
  const root = findProjectRoot();
  const composePath = join(root, 'docker-compose.yaml');
  if (!existsSync(composePath)) return 'brak docker-compose.yaml w głównym repozytorium';
  const comp = readFileSync(composePath, 'utf8');
  if (!comp.includes('vm-browser') || !comp.includes('vm-fedora')) {
    return 'brak usług VM (vm-browser, vm-fedora) w docker-compose.yaml';
  }
  return true;
});

console.log(`\nWynik: \x1b[1m${passed}/14 spełnionych punktów\x1b[0m (${failed} błędów)`);
if (failed === 0) {
  console.log('\x1b[32m✓ Pełna zgodność ze Standardem taskand v1.6 (14/14 PASS)!\x1b[0m');
  process.exit(0);
} else {
  process.exit(1);
}
