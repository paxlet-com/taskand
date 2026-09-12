#!/usr/bin/env node
// proc://taskand.dev/dev/plan/v1 — Generator planu naprawy i rozwoju procesów
import { readFileSync } from 'node:fs';

let input;
if (!process.stdin.isTTY) {
  try {
    const raw = readFileSync(0, 'utf8').trim();
    input = raw ? JSON.parse(raw) : {};
  } catch (e) {
    process.stderr.write('kontrakt fail: niepoprawny JSON na wejściu\n');
    process.exit(2);
  }
} else {
  input = {};
}

const task = input.task || input.prompt || input.title;
if (!task) {
  process.stderr.write('kontrakt fail: brak wymaganego pola task w wejściu\n');
  process.exit(2);
}

const plan = {
  ok: true,
  uri: "proc://taskand.dev/dev/plan/v1",
  task,
  steps: [
    { step: 1, action: "diagnose-error", target: "logs/twin" },
    { step: 2, action: "generate-patch", target: "proc/**/bin.mjs" },
    { step: 3, action: "verify-conformance", target: "make conformance" },
    { step: 4, action: "run-twin-gate-a", target: "twin/qualification.yaml" }
  ],
  estimatedRetries: 1,
  safeToApply: true
};

process.stdout.write(JSON.stringify(plan, null, 2) + '\n');
process.exit(0);
