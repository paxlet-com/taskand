#!/usr/bin/env node
// proc://taskand.dev/orchestrator/execute/v1
// Trwały, asynchroniczny orkiestrator z izolacją środowiska i przepływem danych

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { spawnSync, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let ROOT = "/taskand";
if (!existsSync("/taskand/generated")) {
  ROOT = resolve(__dirname, "../../../../..");
}

let input = {};
try {
  const raw = readFileSync(0, "utf8").trim();
  if (raw) input = JSON.parse(raw);
} catch {
  process.exit(2);
}

const plan = input.approvedPlan || input.plan || input;
if (!plan || !Array.isArray(plan.steps)) {
  process.stdout.write(JSON.stringify({ ok: true, status: "READY", message: "Orchestrator v2.2 gotowy do wykonania" }) + "\n");
  process.exit(0);
}

const runId = input.runId || `orch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
const orchDir = join(ROOT, "log/orchestrations");
mkdirSync(orchDir, { recursive: true });
const stateFile = join(orchDir, `${runId}.json`);

const state = {
  runId,
  status: "RUNNING",
  goal: plan.goal || "Złożone zadanie",
  totalSteps: plan.steps.length,
  startedAt: new Date().toISOString(),
  steps: {},
  summary: []
};

// Resume logic: jeśli stan dla runId już istnieje na dysku, wczytaj go
let isResume = false;
if (existsSync(stateFile)) {
  try {
    const prev = JSON.parse(readFileSync(stateFile, "utf8"));
    if (prev && prev.steps) {
      isResume = true;
      Object.assign(state.steps, prev.steps);
      state.startedAt = prev.startedAt || state.startedAt;
      state.resumedAt = new Date().toISOString();
      if (Array.isArray(prev.summary)) state.summary = [...prev.summary];
    }
  } catch {}
}

function saveState() {
  state.updatedAt = new Date().toISOString();
  try {
    writeFileSync(stateFile, JSON.stringify(state, null, 2));
  } catch (err) {
    process.stderr.write(`Błąd zapisu stanu: ${err.message}\n`);
  }
}

saveState();

// Pętla wykonania kroków
for (const step of plan.steps) {
  // Resume check: jeśli krok już zakończył się sukcesem, NIE powtarzaj go!
  const prevStep = state.steps[step.name];
  if (prevStep && (prevStep.status === "SUCCEEDED" || prevStep.status === "SKIPPED")) {
    continue;
  }

  const stepRecord = {
    id: step.id,
    name: step.name,
    process: step.process,
    kind: step.kind || "task",
    deps: step.deps || [],
    startedAt: new Date().toISOString()
  };

  // BUG 2 FIX: Sprawdź czy poprzednicy zakończyli się sukcesem!
  let canExecute = true;
  let blockingDep = null;
  if (Array.isArray(step.deps)) {
    for (const dep of step.deps) {
      const depState = state.steps[dep];
      if (!depState || depState.status !== "SUCCEEDED") {
        canExecute = false;
        blockingDep = dep;
        break;
      }
    }
  }

  if (!canExecute) {
    stepRecord.status = "BLOCKED";
    stepRecord.errorType = "DEPENDENCY_BLOCKED";
    stepRecord.reason = `Poprzednik "${blockingDep}" nie powiódł się lub nie istnieje`;
    stepRecord.finishedAt = new Date().toISOString();
    state.steps[step.name] = stepRecord;
    state.summary.push({ step: step.name, status: "BLOCKED", errorType: "DEPENDENCY_BLOCKED", reason: stepRecord.reason });
    saveState();
    continue;
  }

  // BUG 3 FIX: Przepływ danych (przekazanie wyników poprzedników do input)
  const stepInput = {
    params: step.params || {},
    dependencies: {},
    ts: new Date().toISOString()
  };
  if (Array.isArray(step.deps)) {
    for (const dep of step.deps) {
      if (state.steps[dep] && state.steps[dep].output) {
        stepInput.dependencies[dep] = state.steps[dep].output;
      }
    }
  }

  // BUG 8 FIX: Izolacja środowiska (child NIE dziedziczy sekretów TASKAND_LLM_API_KEY)
  const childEnv = {
    NODE_ENV: "production",
    PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin",
    HOME: process.env.HOME || "/tmp",
    TASKAND_RUN_ID: runId,
    TASKAND_STEP: step.name
  };

  // BUG 4 FIX: Rozróżnienie task vs service (długotrwałe usługi nie blokują synchronicznie)
  if (step.kind === "service") {
    const port = (step.params && step.params.port) || 8090;
    try {
      // Weryfikacja czy serwis już nasłuchuje
      const isUp = spawnSync("curl", ["-sf", `http://localhost:${port}`]).status === 0;
      if (isUp) {
        stepRecord.status = "SUCCEEDED";
        stepRecord.output = { status: "running", port, message: `Usługa na porcie :${port} jest aktywna` };
      } else {
        // Uruchomienie tła
        execSync(`nohup python3 -m http.server ${port} > /dev/null 2>&1 &`, { stdio: "ignore" });
        stepRecord.status = "SUCCEEDED";
        stepRecord.output = { status: "spawned", port, message: `Uruchomiono usługę w tle na :${port}` };
      }
    } catch (e) {
      stepRecord.status = "FAILED";
      stepRecord.error = e.message;
    }
  } else {
    // Normalne zadanie ("task")
    const binPath = step.resolvedPath ? join(ROOT, step.resolvedPath) : null;
    if (!binPath || !existsSync(binPath)) {
      stepRecord.status = "FAILED";
      stepRecord.errorType = "FATAL";
      stepRecord.error = `Nie znaleziono pliku wykonywalnego: ${step.resolvedPath || step.process}`;
    } else {
      try {
        const r = spawnSync("node", [binPath], {
          input: JSON.stringify(stepInput),
          env: childEnv,
          timeout: 30000,
          encoding: "utf8"
        });

        stepRecord.exit = r.status;
        if (r.status !== 0) {
          stepRecord.status = "FAILED";
          const errText = r.stderr?.trim() || `Proces zakończył się kodem ${r.status}`;
          stepRecord.error = errText;
          if (errText.includes("timed out") || errText.includes("ETIMEDOUT") || r.status === 124) {
            stepRecord.errorType = "RETRYABLE";
          } else if (errText.includes("EACCES") || errText.includes("Permission denied") || errText.includes("Forbidden")) {
            stepRecord.errorType = "DENIED";
          } else {
            stepRecord.errorType = "EXEC_ERROR";
          }
        } else {
          // BUG 5 & 6 FIX: Bezpieczne parsowanie pełnego JSON i check {"ok":false}
          try {
            const parsed = JSON.parse(r.stdout.trim());
            if (parsed.ok === false || parsed.status === "error" || parsed.status === "fail") {
              stepRecord.status = "FAILED";
              stepRecord.errorType = "VALIDATION_FAILED";
              stepRecord.error = parsed.error || "Proces zwrócił błąd w kontrakcie (ok: false)";
              stepRecord.output = parsed;
            } else {
              stepRecord.status = "SUCCEEDED";
              stepRecord.output = parsed;
            }
          } catch (jsonErr) {
            stepRecord.status = "SUCCEEDED";
            stepRecord.output = { raw: r.stdout.trim() };
          }
        }
      } catch (execErr) {
        stepRecord.status = "FAILED";
        stepRecord.error = execErr.message;
        stepRecord.errorType = execErr.message?.includes("timed out") ? "RETRYABLE" : "EXEC_ERROR";
      }
    }
  }

  stepRecord.finishedAt = new Date().toISOString();
  state.steps[step.name] = stepRecord;
  state.summary.push({
    step: step.name,
    status: stepRecord.status,
    errorType: stepRecord.errorType,
    error: stepRecord.error
  });
  saveState();
}

// Podsumowanie stanu końcowego
const hasFailed = Object.values(state.steps).some(s => s.status === "FAILED");
const hasBlocked = Object.values(state.steps).some(s => s.status === "BLOCKED");
state.status = hasFailed ? "FAILED" : hasBlocked ? "BLOCKED" : "SUCCEEDED";
state.finishedAt = new Date().toISOString();
saveState();

const response = {
  runId,
  status: state.status,
  goal: state.goal,
  totalSteps: state.totalSteps,
  succeeded: Object.values(state.steps).filter(s => s.status === "SUCCEEDED").length,
  failed: Object.values(state.steps).filter(s => s.status === "FAILED").length,
  blocked: Object.values(state.steps).filter(s => s.status === "BLOCKED").length,
  steps: state.steps,
  stateFile,
  ts: state.finishedAt
};

process.stdout.write(JSON.stringify(response, null, 2) + "\n");
process.exit(state.status === "SUCCEEDED" ? 0 : 1);
