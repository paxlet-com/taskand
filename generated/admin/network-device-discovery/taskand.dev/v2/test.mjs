import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const r = spawnSync('node', [fileURLToPath(new URL('./bin.mjs', import.meta.url))], { input: '{}', encoding: 'utf8', timeout: 25000 });
const out = JSON.parse(r.stdout.trim().split('\n').pop());
if (r.status !== 0 || typeof out.ok !== 'boolean') process.exit(1);
console.log('✓ PASS');
