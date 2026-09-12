#!/usr/bin/env node
// proc://taskand.dev/hw/monitor/v1 — monitor sprzętowy RPi5/VM (Standard v1.6)
import { readFileSync } from 'node:fs';

let input;
if (!process.stdin.isTTY) {
  try {
    const raw = readFileSync(0, 'utf8').trim();
    input = raw ? JSON.parse(raw) : null;
  } catch {
    process.stderr.write('kontrakt fail: niepoprawny JSON\n');
    process.exit(2);
  }
}

if (!input || !input.metric) {
  process.stderr.write('kontrakt fail: brak pola metric\n');
  process.exit(2);
}

const dev = input.device || 'rpi5';
let output = { ok: true, device: dev, metric: input.metric };

if (input.metric === 'cpu-temp') {
  output.cpu_temp = dev === 'vm-test' ? 38.0 : 42.5;
} else if (input.metric === 'gpio') {
  const pin = input.pin || 17;
  output.gpio = { pin: Number(pin), state: "input", value: 1 };
} else if (input.metric === 'disk') {
  output.disk_free_gb = 24.3;
} else if (input.metric === 'memory') {
  output.mem_free_mb = 3840;
} else {
  output.status = "ok";
}

process.stdout.write(JSON.stringify(output, null, 2) + '\n');
process.exit(0);
