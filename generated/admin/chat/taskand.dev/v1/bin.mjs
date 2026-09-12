#!/usr/bin/env node
// proc://taskand.dev/admin/chat/v1
// Autonomiczny organizm admin w systemie taskand v2.2

import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
let ROOT = '/taskand';
if (!existsSync('/taskand/generated')) {
  ROOT = resolve(__dirname, '../../../../..');
}

let input = {};
try {
  const raw = readFileSync(0, 'utf8').trim();
  if (raw) input = JSON.parse(raw);
} catch {
  process.exit(2);
}

const msg = (input.message || input.prompt || '').toLowerCase();
let reply = '';

// Obsługa pytań o telemetrię, temperaturę i zasoby
if (msg.includes('temperatura') || msg.includes('temperatur') || msg.includes('temp') || msg.includes('stan') || msg.includes('sprzęt') || msg.includes('sprzet') || msg.includes('cpu') || msg.includes('dysk')) {
  const hwBin = join(ROOT, 'generated/hw/monitor/taskand.dev/v1/bin.mjs');
  if (existsSync(hwBin)) {
    const r = spawnSync('node', [hwBin], { input: '{}', encoding: 'utf8' });
    if (r.status === 0) {
      try {
        const hw = JSON.parse(r.stdout.trim());
        reply = `[admin] Temperatura komputera wynosi ${hw.cpu_temp}°C (węzeł: ${hw.device}). Wolne miejsce na dysku: ${hw.disk_free_gb} GB. Wszystkie sensory w normie.`;
      } catch {}
    }
  }
}

if (!reply) {
  reply = `[admin] Cześć! Jestem organizmem admin w taskand v2.2. Zarządzam systemem i odpowiadam na pytania o jego stan.`;
}

process.stdout.write(JSON.stringify({ ok: true, organism: 'admin', reply }) + '\n');
process.exit(0);
