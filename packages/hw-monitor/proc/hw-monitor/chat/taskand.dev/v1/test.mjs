import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const dir = dirname(fileURLToPath(import.meta.url));

const r1 = spawnSync('node', [join(dir, 'bin.mjs')], { input: JSON.stringify({ message: "temperatura CPU", device: "rpi5" }) });
if (r1.status !== 0) process.exit(1);

const r2 = spawnSync('node', [join(dir, 'bin.mjs')], { input: '' });
if (r2.status !== 2) process.exit(1);

console.log('proc://taskand.dev/hw-monitor/chat/v1: kontrakt ✓');
