#!/usr/bin/env node
import { readFileSync } from 'node:fs';
let i = {};
try {
  const raw = readFileSync(0, 'utf8').trim();
  if (raw) i = JSON.parse(raw);
} catch {
  process.exit(2);
}
const KEY = process.env.TASKAND_LLM_API_KEY;
const org = i.organism || 'unknown';
process.stdout.write(JSON.stringify({
  ok: true,
  spawned: org,
  mode: KEY ? 'llm-autonomous' : 'builtin-templates',
  llm: KEY ? (process.env.TASKAND_LLM_MODEL || 'glm-5.3') : null,
  ts: new Date().toISOString()
}) + '\n');
process.exit(0);
