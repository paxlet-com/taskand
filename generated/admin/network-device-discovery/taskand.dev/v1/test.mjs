import { spawnSync } from 'node:child_process';
const r = spawnSync('node', [new URL('./bin.mjs', import.meta.url).pathname], { input: '{}', encoding: 'utf8', timeout: 20000 });
const out = JSON.parse(r.stdout);
if (r.status !== 0 || typeof out.ok !== 'boolean') process.exit(1);
console.log('✓ PASS');
