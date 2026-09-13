#!/usr/bin/env node
// proc://taskand.dev/web/serve/v1 — stan Web Cockpit: realna sonda HTTP (usługę uruchamia docker compose: landing)
// in: { action?: health, port?, host? }
import { readFileSync } from 'node:fs';

let input;
try {
  const raw = readFileSync(0, 'utf8').trim();
  input = raw ? JSON.parse(raw) : {};
} catch {
  process.exit(2);
}
// AbortSignal.timeout nie podtrzymuje pętli zdarzeń — bez tego zawieszone połączenie kończy proces kodem 13 bez wyjścia
setInterval(() => {}, 60000);
const params = input.params || input;
const port = Number(params.port) || 8090;
const url = `http://${params.host || 'localhost'}:${port}/`;
const started = Date.now();
let status = null;
let error = null;
try {
  status = (await fetch(url, { signal: AbortSignal.timeout(3000) })).status;
} catch (err) {
  error = err.cause?.code || err.message;
}
const up = status !== null && status < 500;
process.stdout.write(JSON.stringify({
  ok: up,
  url,
  port,
  http_status: status,
  latency_ms: Date.now() - started,
  ...(up ? {} : { error: `Web Cockpit ${url} nie odpowiada (${error || `HTTP ${status}`}) — docker compose up -d landing` }),
  summary: up ? `Web Cockpit działa: ${url} (HTTP ${status})` : `Web Cockpit ${url} nie działa`,
  ts: new Date().toISOString()
}) + '\n');
process.exit(0);
