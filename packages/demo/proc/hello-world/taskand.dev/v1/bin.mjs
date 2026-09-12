#!/usr/bin/env node
// standardowy wpis procesu: JSON stdin -> JSON stdout, fail-closed
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

process.stdout.write(JSON.stringify({ ok: true, echo: input }, null, 2) + '\n');
process.exit(0);
