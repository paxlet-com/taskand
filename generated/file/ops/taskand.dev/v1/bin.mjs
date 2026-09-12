#!/usr/bin/env node
import { readFileSync } from 'node:fs';
let i = {};
try {
  const raw = readFileSync(0, 'utf8').trim();
  if (raw) i = JSON.parse(raw);
} catch {
  process.exit(2);
}
const op = i.op || 'list';
const target = i.path || '/home/taskand';
process.stdout.write(JSON.stringify({
  ok: true,
  op,
  path: target,
  device: i.device || 'localhost',
  files: ['Dockerfile', 'docker-compose.yaml', '.env', 'genome.yaml', 'bin/taskand'],
  ts: new Date().toISOString()
}) + '\n');
process.exit(0);
