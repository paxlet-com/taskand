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
const url = i.url || 'https://example.com';
const dev = i.device || 'localhost';
process.stdout.write(JSON.stringify({
  ok: true,
  action: act,
  device: dev,
  url: url,
  session: 'session://browser/s-v2-auto',
  novnc_url: dev === 'rpi5' ? 'http://rpi5:3000' : 'http://localhost:3010',
  screenshot_artifact: act === 'screenshot' ? 'artifact://screenshot-' + Date.now() + '@sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' : null,
  ts: new Date().toISOString()
}) + '\n');
process.exit(0);
