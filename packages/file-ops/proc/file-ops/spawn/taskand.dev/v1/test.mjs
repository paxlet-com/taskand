import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const dir = dirname(fileURLToPath(import.meta.url));
const res = spawnSync('node', [join(dir, 'bin.mjs')], { input: JSON.stringify({ name: "test-child" }) });
if (res.status !== 0) process.exit(1);
console.log('proc://taskand.dev/file-ops/spawn/v1: kontrakt ✓');
