#!/usr/bin/env node
import { readFileSync } from 'node:fs';
let i = {};
try {
  const raw = readFileSync(0, 'utf8').trim();
  if (raw) i = JSON.parse(raw);
} catch {
  process.exit(2);
}
process.stdout.write(JSON.stringify({
  ok: true,
  device: i.device || 'localhost',
  cpu_temp: 42.5,
  cpu_usage_pct: 14.2,
  disk_free_gb: 24.8,
  gpio_pins: { '17': 'HIGH', '27': 'LOW' },
  ts: new Date().toISOString()
}) + '\n');
process.exit(0);
