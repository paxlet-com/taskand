#!/usr/bin/env node
// proc://taskand.dev/nginx/status/v1 — Adapter stanu usługi nginx na porcie :8090
import { readFileSync } from 'node:fs';

let input = {};
if (!process.stdin.isTTY) {
  try { const r = readFileSync(0, 'utf8').trim(); input = r ? JSON.parse(r) : {}; } catch(e) {}
}

const targetUrl = input.url || "http://localhost:8090";
let status = 200;
let ok = true;
let latencyMs = 12;

try {
  const res = await fetch(targetUrl, { signal: AbortSignal.timeout(1500) });
  status = res.status;
  ok = res.ok;
} catch(e) {
  ok = false;
  status = 0;
}

const out = {
  ok,
  uri: "proc://taskand.dev/nginx/status/v1",
  service: "nginx",
  url: targetUrl,
  status,
  timestamp: new Date().toISOString()
};
process.stdout.write(JSON.stringify(out, null, 2) + '\n');
process.exit(0);
