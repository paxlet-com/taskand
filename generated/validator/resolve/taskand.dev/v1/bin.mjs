#!/usr/bin/env node
// proc://taskand.dev/validator/resolve/v1
// Deterministyczny walidator grafu, sekretów i URI (przez registry/core)

import { readFileSync } from "node:fs";
import { registry } from "./registry-client.mjs";

let input = {};
try {
  const raw = readFileSync(0, "utf8").trim();
  if (raw) input = JSON.parse(raw);
} catch {
  process.exit(2);
}

const blueprint = input.blueprint || input;
if (!blueprint || !Array.isArray(blueprint.steps)) {
  process.stdout.write(JSON.stringify({
    ok: false,
    valid: false,
    status: "REJECTED",
    errors: ["Brak sekcji steps w blueprint"]
  }, null, 2) + "\n");
  process.exit(0);
}

const steps = blueprint.steps;
const errors = [];
const unresolvedCapabilities = [];

// 1. Unikalność ID i nazw kroków (BUG 10)
const ids = new Set();
const names = new Set();
for (const s of steps) {
  if (s.id === undefined || s.id === null) {
    errors.push(`Krok "${s.name}" nie posiada pola id`);
  } else if (ids.has(s.id)) {
    errors.push(`Zduplikowane id kroku: ${s.id}`);
  } else {
    ids.add(s.id);
  }

  if (!s.name) {
    errors.push(`Krok id=${s.id} nie posiada pola name`);
  } else if (names.has(s.name)) {
    errors.push(`Zduplikowana nazwa kroku: "${s.name}"`);
  } else {
    names.add(s.name);
  }
}

// 2. Weryfikacja istnienia zależności (deps)
for (const s of steps) {
  if (Array.isArray(s.deps)) {
    for (const d of s.deps) {
      if (!names.has(d)) {
        errors.push(`Krok "${s.name}" zależy od nieistniejącego kroku "${d}"`);
      }
    }
  }
}

// 3. Detekcja cykli w grafie zależności (3-kolorowy DFS - BUG 10)
const color = new Map(); // 0 = WHITE (nieodwiedzony), 1 = GREY (w trakcie), 2 = BLACK (zakończony)
const stepMap = new Map();
steps.forEach(s => {
  color.set(s.name, 0);
  stepMap.set(s.name, s);
});

let hasCycle = false;
let cyclePath = [];

function dfs(nodeName, path) {
  color.set(nodeName, 1); // GREY
  const currentStep = stepMap.get(nodeName);
  if (currentStep && Array.isArray(currentStep.deps)) {
    for (const dep of currentStep.deps) {
      if (color.get(dep) === 1) { // Cykl!
        hasCycle = true;
        cyclePath = [...path, nodeName, dep];
        return;
      }
      if (color.get(dep) === 0) {
        dfs(dep, [...path, nodeName]);
        if (hasCycle) return;
      }
    }
  }
  color.set(nodeName, 2); // BLACK
}

for (const s of steps) {
  if (color.get(s.name) === 0) {
    dfs(s.name, []);
    if (hasCycle) break;
  }
}

if (hasCycle) {
  errors.push(`Cykliczna zależność wykryta w grafie: ${cyclePath.join(" -> ")}`);
}

// 4. Bezpieczeństwo parametrów i sekretów (BUG 9)
for (const s of steps) {
  const p = s.params || {};
  for (const key of Object.keys(p)) {
    if (key.toLowerCase().includes("token") || key.toLowerCase().includes("secret") || key.toLowerCase().includes("password")) {
      const val = String(p[key]);
      if (!val.startsWith("vault://")) {
        errors.push(`Krok "${s.name}": Niedozwolony jawny sekret w parametrze "${key}". Wymagany format: credentialRef: "vault://..."`);
      }
    }
  }
}

// 5. Rozwiązanie procesów URI przez rejestr (status active + bindingHash weryfikuje registry/core)
const resolvedSteps = [];
const activeCatalog = registry('list', { status: 'active' });
for (const s of steps) {
  const stepCopy = { ...s };
  if (s.process && s.process.startsWith("spawn:")) {
    const match = /^spawn:(?:([a-z0-9-]+)\/)?([a-z0-9-]+)$/.exec(s.process);
    const candidates = match ? (activeCatalog.processes || []).filter(p =>
      p.uri.match(/^proc:\/\/taskand\.dev\/[^/]+\/([^/]+)\/v\d+$/)?.[1] === match[2] && (!match[1] || p.organism === match[1])) : [];
    const owners = [...new Set(candidates.map(p => p.organism))];
    if (owners.length === 1) {
      const reused = registry('select', { organism: owners[0], capability: match[2] });
      if (reused.ok) {
        resolvedSteps.push({ ...stepCopy, process: reused.uri, hash: reused.entry.hash, kind: reused.entry.kind, reused: true });
        continue;
      }
      errors.push(`Krok "${s.name}": istniejący proces nie przeszedł weryfikacji: ${reused.error}`);
    }
    unresolvedCapabilities.push({
      stepId: s.id,
      name: s.name,
      requestedProcess: s.process,
      description: s.description
    });
  } else if (s.process) {
    const res = registry("resolve", { uri: s.process });
    if (!res.ok) {
      errors.push(`Krok "${s.name}": ${res.errorType === "NOT_FOUND" ? "Proces URI nieznany w rejestrze" : "Proces odrzucony przez rejestr"}: ${res.error}`);
    } else {
      stepCopy.kind = res.entry.kind || "task";
      stepCopy.hash = res.entry.hash;
    }
  } else {
    errors.push(`Krok "${s.name}" nie definiuje procesu (pole process)`);
  }
  resolvedSteps.push(stepCopy);
}

// 6. Sortowanie topologiczne kroków (poprawna kolejność wykonania)
const sorted = [];
const visited = new Set();
function visit(stepName) {
  if (visited.has(stepName)) return;
  visited.add(stepName);
  const stepObj = resolvedSteps.find(s => s.name === stepName);
  if (stepObj && Array.isArray(stepObj.deps)) {
    stepObj.deps.forEach(visit);
  }
  if (stepObj) sorted.push(stepObj);
}
resolvedSteps.forEach(s => visit(s.name));

const isValid = errors.length === 0;
const status = !isValid
  ? "REJECTED"
  : unresolvedCapabilities.length > 0
    ? "NEEDS_EVOLUTION"
    : "APPROVED";

const response = {
  ok: isValid,
  valid: isValid,
  status,
  errors: errors.length > 0 ? errors : undefined,
  unresolvedCapabilities: unresolvedCapabilities.length > 0 ? unresolvedCapabilities : undefined,
  approvedPlan: isValid ? {
    goal: blueprint.goal || "Złożone zadanie taskand v2.2",
    totalSteps: sorted.length,
    steps: sorted
  } : undefined,
  ts: new Date().toISOString()
};

process.stdout.write(JSON.stringify(response, null, 2) + "\n");
process.exit(isValid ? 0 : 1);
