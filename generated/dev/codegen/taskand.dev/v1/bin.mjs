#!/usr/bin/env node
import { readFileSync } from 'node:fs';
let i = {};
try {
  const raw = readFileSync(0, 'utf8').trim();
  if (raw) i = JSON.parse(raw);
} catch {
  process.exit(2);
}
const desc = i.desc || i.prompt || 'nowy proces';
process.stdout.write(JSON.stringify({
  ok: true,
  generated_code: `// Kod wygenerowany dla: ${desc}\nprocess.stdout.write(JSON.stringify({ ok: true }));`,
  uri: `proc://taskand.dev/custom/${Date.now()}/v1`,
  ts: new Date().toISOString()
}) + '\n');
process.exit(0);
