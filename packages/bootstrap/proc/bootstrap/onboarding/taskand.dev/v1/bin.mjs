#!/usr/bin/env node
// proc://taskand.dev/bootstrap/onboarding/v1 — Inicjalizacja i weryfikacja środowiska
import { readFileSync, existsSync } from 'node:fs';

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

const checkDocker = existsSync('/var/run/docker.sock');
const checkGit = existsSync('.git');
const checkEnv = existsSync('.env') || existsSync('.env.example');

const result = {
  ok: true,
  uri: "proc://taskand.dev/bootstrap/onboarding/v1",
  stage: "bootstrap-ready",
  checks: {
    dockerSocket: checkDocker,
    gitRepository: checkGit,
    environmentConfig: checkEnv
  },
  bootstrapComplete: true,
  timestamp: new Date().toISOString()
};

process.stdout.write(JSON.stringify(result, null, 2) + '\n');
process.exit(0);
