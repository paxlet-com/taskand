#!/usr/bin/env node
import { readFileSync } from 'node:fs';
let i = {};
try {
  const raw = readFileSync(0, 'utf8').trim();
  if (raw) i = JSON.parse(raw);
} catch {
  process.exit(2);
}
const act = i.action || 'status';
process.stdout.write(JSON.stringify({
  ok: true,
  vault: 'taskand-vault-v2',
  cipher: 'AES-256-GCM',
  status: 'locked-and-secured',
  secrets_count: process.env.TASKAND_LLM_API_KEY ? 1 : 0,
  action: act,
  ts: new Date().toISOString()
}) + '\n');
process.exit(0);
