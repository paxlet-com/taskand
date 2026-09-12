// Dispatch intencji dev/chat → procesy proc:// (bez logiki domenowej w dev/chat)
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { callProc, uriToPath, adoptOwnership } from '../../../../_lib/proc.mjs';
import { register } from '../../../../_lib/catalog.mjs';
import { dirname } from 'node:path';

const P = name => `proc://taskand.dev/${name}/v1`;
const replyOf = (r, fallback) => r.reply || (r.ok === false ? `✗ ${r.error}` : fallback);

export const HANDLERS = {
  'spawn-organism': ({ match }) => spawnOrganism(match[1].toLowerCase(), match[2]),
  composite: ({ text }) => replyOf(callProc(P('dev/composite'), { task: text }, { timeout: 900000 })),
  telemetry: () => telemetry(),
  'file-ops': ({ text }) => replyOf(callProc(P('dev/file-router'), { message: text })),
  'spawn-web': () => webStatus(),
  diagnose: () => diagnose(),
  'evolve-create': ({ text }) => replyOf(callProc(P('dev/act'), { message: text, forceEvolve: true }, { timeout: 600000 })),
  query: ({ text }) => replyOf(callProc(P('dev/act'), { message: text }, { timeout: 600000 }))
};

export function dispatch(intent) {
  return HANDLERS[intent.name](intent);
}

function telemetry() {
  const hw = callProc(P('hw/monitor'));
  if (hw.ok === false) return `[developer] Błąd odczytu telemetrii: ${hw.error}`;
  const sensors = (hw.sensors || []).slice(0, 4).map(s => `${s.sensor}: ${s.temp_c}°C`).join(', ');
  return [
    `[developer] Odczyt czujników sprzętowych (węzeł: ${hw.device}):`,
    `  • Temperatura CPU: ${hw.cpu_temp ?? 'brak odczytu'}°C (${hw.cpu_temp_source || 'n/d'})`,
    `  • Obciążenie CPU: ${hw.cpu_usage_pct ?? 'n/d'}%`,
    `  • Wolne miejsce na dysku: ${hw.disk_free_gb ?? 'n/d'} GB`,
    ...(sensors ? [`  • Czujniki: ${sensors}`] : []),
    `  • Status: ${hw.summary}`
  ].join('\n');
}

function diagnose() {
  const d = callProc(P('doctor/diagnose'));
  if (d.ok === false && !d.details) return `[doctor] fail-closed: ${d.error}`;
  return [`[doctor] Stan zdrowia: healthy=${d.healthy ? '✓' : '✗'} (${d.passed}/${d.checks})`, ...(d.details || []).map(x => `  · ${x}`)].join('\n');
}

function webStatus() {
  const d = callProc(P('doctor/diagnose'));
  const web = (d.details || []).filter(x => /landing|vm-browser/.test(x));
  return ['[developer] Intent: spawn-web — interfejsy WWW:', ...web.map(x => `  · ${x}`), '  Proc URI: proc://taskand.dev/web/serve/v1'].join('\n');
}

// Organizm = cienki interfejs konwersacyjny delegujący do dev/act (wybór procesu lub ewolucja)
function spawnOrganism(organism, capability) {
  const uri = P(`${organism}/chat`);
  const bin = uriToPath(uri);
  const created = !existsSync(bin);
  if (created) {
    mkdirSync(dirname(bin), { recursive: true });
    writeFileSync(bin, organismTemplate(organism, uri), { mode: 0o755 });
    register({ uri, desc: `Interfejs konwersacyjny organizmu ${organism}`, organism });
    adoptOwnership(dirname(bin));
  }
  const lines = [`[developer] ${created ? 'Powołano' : 'Organizm już istnieje'}: ${organism} (${uri})`];
  if (capability) {
    const r = callProc(P('dev/act'), { organism, message: capability }, { timeout: 600000 });
    lines.push(replyOf(r, '(brak odpowiedzi)'));
  }
  lines.push(`Użycie: taskand ${organism} "<zadanie>"`);
  return lines.join('\n');
}

export function organismTemplate(organism, uri) {
  return `#!/usr/bin/env node
// ${uri} — organizm ${organism}: deleguje każde zadanie do dev/act (wybór procesu z katalogu lub ewolucja)
import { readInput, emit, callProc } from '../../../../_lib/proc.mjs';

const input = readInput();
const message = input.message || input.prompt || '';
if (!message) emit({ ok: true, organism: '${organism}', reply: '[${organism}] Gotowy. Podaj zadanie.' });
const r = callProc('proc://taskand.dev/dev/act/v1', { organism: '${organism}', message }, { timeout: 600000 });
emit({ ok: r.ok !== false, organism: '${organism}', reply: r.reply || r.error, action: r.action, uri: r.uri });
`;
}
