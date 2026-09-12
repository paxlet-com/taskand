#!/usr/bin/env node
// proc://taskand.dev/hw-monitor/spawn/v1
import { readFileSync } from 'node:fs';

let input = {};
if (!process.stdin.isTTY) {
  try {
    const raw = readFileSync(0, 'utf8').trim();
    input = raw ? JSON.parse(raw) : {};
  } catch (e) {
    process.stderr.write('kontrakt fail: niepoprawny JSON\n');
    process.exit(2);
  }
}
const childName = input.name || input.targetName || "child-hw-" + Date.now();
const res = {
  ok: true,
  uri: "proc://taskand.dev/hw-monitor/spawn/v1",
  parent: "taskand-hw-monitor",
  spawned: childName,
  role: input.role || "worker",
  status: "active",
  timestamp: new Date().toISOString()
};
process.stdout.write(JSON.stringify(res, null, 2) + '\n');
process.exit(0);
