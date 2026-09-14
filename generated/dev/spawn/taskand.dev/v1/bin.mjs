#!/usr/bin/env node
// proc://taskand.dev/dev/spawn/v1 — powołanie organizmu: pakiet <org>/chat (deleguje do dev/act) + rejestracja
// in:  { organism, capability? }  — capability: od razu zapewnij zdolność (wybór procesu lub ewolucja)
// out: { ok, uri, created, status, reply }
import { readFileSync, mkdirSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { registry, call } from './registry-client.mjs';

let input;
try {
  const raw = readFileSync(0, 'utf8').trim();
  input = raw ? JSON.parse(raw) : {};
} catch {
  process.exit(2);
}

const done = out => {
  process.stdout.write(JSON.stringify(out) + '\n');
  process.exit(0);
};
const organism = String(input.organism || '').toLowerCase();
if (!/^[a-z0-9][a-z0-9-]{0,30}$/.test(organism)) done({ ok: false, error: 'Wymagane: organism (a-z, 0-9, -)' });
if (['registry', 'dev', 'planner', 'validator', 'orchestrator'].includes(organism)) done({ ok: false, error: `Organizm ${organism} jest zarezerwowany` });

const uri = `proc://taskand.dev/${organism}/chat/v1`;
const dir = fileURLToPath(new URL(`../../../../${organism}/chat/taskand.dev/v1/`, import.meta.url));
const created = !existsSync(join(dir, 'bin.mjs'));
if (created) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'bin.mjs'), template(), { mode: 0o755 });
  copyFileSync(fileURLToPath(new URL('./registry-client.mjs', import.meta.url)), join(dir, 'registry-client.mjs'));
  writeFileSync(join(dir, 'proc.yaml'), `uri: ${uri}\norganism: ${organism}\nkind: interface\norigin: builtin\ndesc: "Interfejs konwersacyjny organizmu ${organism} (deleguje do dev/act)"\n`);
}
const reg = registry('register', { uri });
if (!reg.ok) done({ ok: false, uri, error: reg.error });

const lines = [`[dev] ${created ? 'Powołano' : 'Organizm już istnieje'}: ${organism} (${uri}, status: ${reg.entry.status})`];
if (input.capability) {
  const r = call('proc://taskand.dev/dev/act/v1', { organism, message: input.capability }, 900000);
  lines.push(r.reply || `✗ ${r.error}`);
}
lines.push(`Użycie: taskand ${organism} "<zadanie>"`);
done({ ok: true, uri, created, status: reg.entry.status, reply: lines.join('\n') });

function template() {
  return `#!/usr/bin/env node
// ${uri} — organizm ${organism}: każde zadanie → dev/act (wybór procesu z rejestru lub ewolucja)
import { readFileSync } from 'node:fs';
import { call } from './registry-client.mjs';

let input;
try {
  const raw = readFileSync(0, 'utf8').trim();
  input = raw ? JSON.parse(raw) : {};
} catch {
  process.exit(2);
}
const message = input.message || input.prompt || '';
const r = message
  ? call('proc://taskand.dev/dev/act/v1', { organism: '${organism}', message }, 900000)
  : { ok: true, reply: '[${organism}] Gotowy. Podaj zadanie.' };
process.stdout.write(JSON.stringify({ ok: r.ok !== false, organism: '${organism}', reply: r.reply || r.error, action: r.action, uri: r.uri }) + '\\n');
process.exit(0);
`;
}
