#!/usr/bin/env node
// proc://taskand.dev/developer/test-auto/v1 — testowy proces
import { readFileSync } from 'node:fs';

let input;
if (!process.stdin.isTTY) {
  try {
    const raw = readFileSync(0, 'utf8').trim();
    input = raw ? JSON.parse(raw) : {};
  } catch (e) {
    process.stderr.write('kontrakt fail: niepoprawny JSON\n');
    process.exit(2);
  }
} else {
  input = {};
}

const text = input.text || input.data || input.query || '';
const sentences = text ? text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean).slice(0, 5) : [];

const output = {
  ok: true,
  uri: "proc://taskand.dev/developer/test-auto/v1",
  sentences,
  count: sentences.length,
  timestamp: new Date().toISOString()
};

process.stdout.write(JSON.stringify(output, null, 2) + '\n');
process.exit(0);
