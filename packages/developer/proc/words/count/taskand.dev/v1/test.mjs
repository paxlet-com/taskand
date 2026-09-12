import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const dir = dirname(fileURLToPath(import.meta.url));
const res = spawnSync('node', [join(dir, 'bin.mjs')], { input: JSON.stringify({ text: "ala ma kota a kot ma ale" }) });
if (res.status !== 0) process.exit(1);
const out = JSON.parse(res.stdout);
if (!out.ok || out.totalWords !== 7) process.exit(1);
console.log('proc://taskand.dev/words/count/v1: kontrakt ✓');
