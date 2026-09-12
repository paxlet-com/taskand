#!/usr/bin/env node
import { readFileSync } from 'node:fs';
let input = {};
if (!process.stdin.isTTY) {
  try {
    const raw = readFileSync(0, 'utf8').trim();
    input = raw ? JSON.parse(raw) : {};
  } catch(e) {
    process.stderr.write('kontrakt fail: niepoprawny JSON\n');
    process.exit(2);
  }
}
const text = input.text || input.content || input.prompt || "";
const words = text ? text.trim().split(/\s+/).filter(Boolean) : [];
const out = {
  ok: true,
  uri: "proc://taskand.dev/words/count/v1",
  totalWords: words.length,
  totalChars: text.length,
  words: words.slice(0, 20),
  timestamp: new Date().toISOString()
};
process.stdout.write(JSON.stringify(out, null, 2) + '\n');
process.exit(0);
