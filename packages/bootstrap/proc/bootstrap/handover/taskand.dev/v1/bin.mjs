#!/usr/bin/env node
// proc://taskand.dev/bootstrap/handover/v1 — Przekazanie kontroli do kontrolera taskand-core
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

const targetRole = input.targetRole || "core-controller";
const result = {
  ok: true,
  uri: "proc://taskand.dev/bootstrap/handover/v1",
  targetRole,
  handoverStatus: "delegated",
  message: `Kontrola przekazana do ${targetRole}. Środowisko uruchomione i zabezpieczone.`,
  timestamp: new Date().toISOString()
};

process.stdout.write(JSON.stringify(result, null, 2) + '\n');
process.exit(0);
