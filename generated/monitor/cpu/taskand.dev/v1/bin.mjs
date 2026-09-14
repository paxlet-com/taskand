#!/usr/bin/env node
// proc://taskand.dev/monitor/cpu/v1 — bieżące obciążenie CPU (próbka 500 ms z os.cpus), bez wartości domyślnych
import { readFileSync } from 'node:fs';
import os from 'node:os';

let input;
try {
  const raw = readFileSync(0, 'utf8').trim();
  input = raw ? JSON.parse(raw) : {};
} catch {
  process.exit(2);
}

const SAMPLE_MS = 500;
const times = () => os.cpus().reduce((acc, c) => {
  const t = c.times;
  acc.idle += t.idle;
  acc.total += t.user + t.nice + t.sys + t.idle + t.irq;
  return acc;
}, { idle: 0, total: 0 });

const a = times();
await new Promise(r => setTimeout(r, SAMPLE_MS));
const b = times();
const total = b.total - a.total;
const cpuPct = total > 0 ? Math.round((1 - (b.idle - a.idle) / total) * 1000) / 10 : null;

process.stdout.write(JSON.stringify({
  ok: cpuPct !== null,
  device: os.hostname(),
  metric: 'cpu_usage',
  cpu_pct: cpuPct,
  sample_ms: SAMPLE_MS,
  cores: os.cpus().length,
  load_avg: os.loadavg(),
  mem_free_mb: Math.round(os.freemem() / 1024 / 1024),
  summary: cpuPct === null ? 'Brak odczytu CPU' : `CPU ${cpuPct}% (${os.cpus().length} rdzeni)`,
  ts: new Date().toISOString()
}) + '\n');
process.exit(0);
