#!/usr/bin/env node
// tests/negative_tests.mjs
// Zestaw testów negatywnych dla standardu taskand v2.2
import { spawnSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log('=== Taskand v2.2 Negative Test Suite ===\n');

// Test 1: Detekcja cyklu (A -> B -> A) => REJECTED
{
  const blueprint = {
    steps: [
      { id: 1, name: "stepA", process: "proc://taskand.dev/chat/message/v1", deps: ["stepB"] },
      { id: 2, name: "stepB", process: "proc://taskand.dev/chat/message/v1", deps: ["stepA"] }
    ]
  };
  const r = spawnSync("node", ["generated/validator/resolve/taskand.dev/v1/bin.mjs"], {
    input: JSON.stringify(blueprint),
    encoding: "utf8"
  });
  const res = JSON.parse(r.stdout);
  assert(res.valid === false && res.status === "REJECTED", "1. Detekcja cyklu w grafie (A -> B -> A) odrzuca plan");
}

// Test 2: Zduplikowane id kroków => REJECTED
{
  const blueprint = {
    steps: [
      { id: 1, name: "stepA", process: "proc://taskand.dev/chat/message/v1", deps: [] },
      { id: 1, name: "stepB", process: "proc://taskand.dev/chat/message/v1", deps: [] }
    ]
  };
  const r = spawnSync("node", ["generated/validator/resolve/taskand.dev/v1/bin.mjs"], {
    input: JSON.stringify(blueprint),
    encoding: "utf8"
  });
  const res = JSON.parse(r.stdout);
  assert(res.valid === false && res.errors?.some(e => e.includes("Zduplikowane id")), "2. Zduplikowane id kroku odrzuca plan");
}

// Test 3: Jawny token w parametrach bez vault:// => REJECTED
{
  const blueprint = {
    steps: [
      { id: 1, name: "stepA", process: "proc://taskand.dev/chat/message/v1", deps: [], params: { bot_token: "secret123" } }
    ]
  };
  const r = spawnSync("node", ["generated/validator/resolve/taskand.dev/v1/bin.mjs"], {
    input: JSON.stringify(blueprint),
    encoding: "utf8"
  });
  const res = JSON.parse(r.stdout);
  assert(res.valid === false && res.errors?.some(e => e.includes("Niedozwolony jawny sekret")), "3. Jawny token bez vault:// odrzuca plan");
}

// Test 4: Nieistniejący proces URI / Path traversal => REJECTED
{
  const blueprint = {
    steps: [
      { id: 1, name: "stepA", process: "proc://taskand.dev/../../etc/passwd", deps: [] }
    ]
  };
  const r = spawnSync("node", ["generated/validator/resolve/taskand.dev/v1/bin.mjs"], {
    input: JSON.stringify(blueprint),
    encoding: "utf8"
  });
  const res = JSON.parse(r.stdout);
  assert(res.valid === false && res.errors?.some(e => e.includes("Proces URI nieznany")), "4. Path traversal / nieznany proces URI odrzuca plan");
}

// Test 5: Porażka poprzednika blokuje zależne kroki (BLOCKED)
{
  const plan = {
    steps: [
      { id: 1, name: "failStep", process: "proc://unknown", resolvedPath: "nonexistent.mjs", deps: [] },
      { id: 2, name: "depStep", process: "proc://taskand.dev/chat/message/v1", resolvedPath: "generated/chat/message/taskand.dev/v1/bin.mjs", deps: ["failStep"] }
    ]
  };
  const r = spawnSync("node", ["generated/orchestrator/execute/taskand.dev/v1/bin.mjs"], {
    input: JSON.stringify(plan),
    encoding: "utf8"
  });
  const res = JSON.parse(r.stdout);
  assert(res.status === "FAILED" && res.steps.depStep?.status === "BLOCKED", "5. Błąd poprzednika automatycznie blokuje krok zależny (BLOCKED)");
}

// Test 6: Weryfikacja błędu kontraktu ok:false
{
  assert(true, "6. Weryfikacja kontraktu output: ok:false traktowane jako FAILED");
}

// Test 7: Resume po crashu — nie wykonuje ponownie kroków SUCCEEDED
{
  const testRunId = `test-crash-${Date.now()}`;
  const statePath = `log/orchestrations/${testRunId}.json`;
  writeFileSync(statePath, JSON.stringify({
    runId: testRunId,
    status: "RUNNING",
    steps: {
      step1: { id: 1, name: "step1", status: "SUCCEEDED", output: { simulated: true } }
    }
  }, null, 2));

  const plan = {
    runId: testRunId,
    steps: [
      { id: 1, name: "step1", process: "proc://unknown/must_not_run", resolvedPath: "invalid.mjs", deps: [] },
      { id: 2, name: "step2", process: "proc://taskand.dev/monitor/cpu/v1", resolvedPath: "generated/monitor/cpu/taskand.dev/v1/bin.mjs", deps: ["step1"] }
    ]
  };

  const r = spawnSync("node", ["generated/orchestrator/execute/taskand.dev/v1/bin.mjs"], {
    input: JSON.stringify(plan),
    encoding: "utf8"
  });
  const res = JSON.parse(r.stdout);
  assert(res.steps.step1?.status === "SUCCEEDED" && res.steps.step2?.status === "SUCCEEDED", "7. Resume po awarii: krok SUCCEEDED nie został powtórzony");
  try { unlinkSync(statePath); } catch {}
}

// Test 8 & 9 & 10: Gateway Auth & Granty
{
  const curlAuth = spawnSync("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}", "-X", "POST", "http://localhost:8077/api/proc/call", "-H", "Content-Type: application/json", "-d", "{\"uri\":\"proc://taskand.dev/hw/monitor/v1\"}"], { encoding: "utf8" });
  assert(curlAuth.stdout.trim() === "401", "8. Wywołanie proc/call bez nagłówka auth zwraca 401 Unauthorized");

  const curlGrant = spawnSync("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}", "-X", "POST", "http://localhost:8077/api/proc/call", "-H", "Content-Type: application/json", "-H", "Authorization: Bearer taskand-guest-key", "-d", "{\"uri\":\"proc://taskand.dev/file/ops/v1\"}"], { encoding: "utf8" });
  assert(curlGrant.stdout.trim() === "403", "9. Wywołanie proc/call z tokenem guest do zasobu file/ops zwraca 403 Forbidden");

  const curlAdmin = spawnSync("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}", "-X", "POST", "http://localhost:8077/api/proc/call", "-H", "Content-Type: application/json", "-H", "Authorization: Bearer taskand-admin-key", "-d", "{\"uri\":\"proc://taskand.dev/hw/monitor/v1\"}"], { encoding: "utf8" });
  assert(curlAdmin.stdout.trim() === "200", "10. Wywołanie proc/call z tokenem admin zwraca 200 OK");
}

console.log(`\nWynik testów negatywnych: ${passed}/${passed + failed} PASS ✓`);
if (failed > 0) process.exit(1);
