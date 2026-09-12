import { spawnSync } from 'node:child_process';
const r = spawnSync('node', ['bin.mjs'], { input: JSON.stringify({ message: 'status' }), encoding: 'utf8' });
if (r.status !== 0) process.exit(1);
const out = JSON.parse(r.stdout);
if (!out.ok) process.exit(2);
console.log('✓ PASS');
