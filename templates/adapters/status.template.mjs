#!/usr/bin/env node
// Adapter stanu usługi w architekturze federacyjnej taskand v1.5
import { readFileSync } from 'node:fs';

const targetUrl = process.env.SERVICE_URL || "http://localhost:8090";
let status = 200;
let ok = true;

try {
  const res = await fetch(targetUrl, { signal: AbortSignal.timeout(2000) });
  status = res.status;
  ok = res.ok;
} catch (e) {
  ok = false;
  status = 0;
}

const out = {
  ok,
  url: targetUrl,
  status,
  timestamp: new Date().toISOString()
};
process.stdout.write(JSON.stringify(out, null, 2) + '\n');
process.exit(ok ? 0 : 1);
