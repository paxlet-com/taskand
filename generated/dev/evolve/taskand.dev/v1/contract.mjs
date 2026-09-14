// Kontrakt pakietu taskand: reguły dla generatora, guard statyczny, test kontraktu
import { spawnSync } from 'node:child_process';

export const MAX_MODULE_LINES = 180;

export const RULES = `Jesteś generatorem pakietów procesów systemu taskand. Pakiet = katalog modułów ESM.

KONTRAKT (obowiązkowy):
- Node.js >= 20, ESM. bin.mjs zaczyna się od: #!/usr/bin/env node
- Importy WYŁĄCZNIE "node:*" oraz moduły siostrzane tego pakietu ("./nazwa.mjs"). Brak npm.
- Każdy moduł <= ${MAX_MODULE_LINES} linii, jedna odpowiedzialność na moduł (np. probe-arp.mjs, probe-mdns.mjs, merge.mjs); bin.mjs tylko składa wynik.
- Wejście: jeden obiekt JSON na stdin (może być "{}"). Niepoprawny JSON → process.exit(2).
- Wyjście: DOKŁADNIE jedna linia JSON na stdout z polem "ok" (boolean) i "summary" (1 zdanie po polsku), potem process.exit(0).
- Dla "{}" wykonaj domyślną, bezpieczną akcję tylko do odczytu i zwróć realne dane.

PRAWDOMÓWNOŚĆ:
- Zwracaj WYŁĄCZNIE dane zmierzone/odczytane w czasie wykonania. Zero wartości zmyślonych lub przykładowych.
- Brak narzędzia (np. nmap) → alternatywy (ip neigh, /proc/net/arp, /sys, /proc). Niemożliwe → {"ok": false, "error": "<powód>"}.
- Filtruj oczywisty szum (np. pseudo-systemy plików squashfs/tmpfs/overlay przy analizie dysków).

BEZPIECZEŃSTWO:
- Tylko odczyt. Żadnego usuwania/modyfikacji plików, sudo, instalacji, restartów. Nie czytaj plików .env ani katalogu generated/.
- Każde child_process: timeout <= 15000 ms. Całość < 20 s.
- Sieć: fetch/sockety zawsze z limitem czasu; przy AbortSignal.timeout dodaj setInterval(() => {}, 60000) (timer abort nie podtrzymuje pętli) i kończ przez process.exit(0). Brak wysyłania danych do hostów spoza sieci lokalnej.

Zwróć WYŁĄCZNIE JSON: {"description": "<1 zdanie>", "files": {"bin.mjs": "<treść>", "<moduł>.mjs": "<treść>"}}`;

const DENY = [
  [/\brm\s+-[a-z]*r/i, 'rm -r'],
  [/\bsudo\b/, 'sudo'],
  [/\bmkfs|\bdd\s+if=|>\s*\/dev\/sd/, 'operacja na dysku'],
  [/\b(shutdown|reboot|poweroff|halt)\b/, 'zarządzanie zasilaniem'],
  [/\b(apt|apt-get|apk|yum|dnf|pip|npm)\s+(install|add)\b/, 'instalacja pakietów'],
  [/(curl|wget)[^\n|]*\|\s*(ba)?sh/, 'pipe do shella'],
  [/\b(unlinkSync|rmSync|rmdirSync|unlink|rm|writeFileSync|appendFileSync)\s*\(/, 'zapis/usuwanie plików'],
  [/TASKAND_[A-Z_]*(KEY|TOKEN|SECRET|CREDENTIAL)|['"`/]\.env\b|generated\/|registry\.json|genome\.yaml/, 'dostęp do sekretów lub samomodyfikacja'],
  [/\beval\s*\(|new Function\s*\(/, 'eval']
];

// Jednoliniowo: `… from '<spec>'` na końcu linii, `import '<spec>'`, dynamiczny import() i require()
const IMPORT_RE = /(?:^|[\s}])from[ \t]*['"]([^'"\n]+)['"][ \t]*;?[ \t]*$|^[ \t]*import[ \t]*['"]([^'"\n]+)['"]|\bimport\([ \t]*['"]([^'"\n]+)['"]|\brequire\([ \t]*['"]([^'"\n]+)['"]/gm;

// Zwraca listę naruszeń dla całego pakietu (pusta = OK)
export function guard(files) {
  const violations = [];
  for (const [name, code] of Object.entries(files)) {
    if (!/^[a-z0-9][\w-]*\.mjs$/.test(name)) violations.push(`${name}: niedozwolona nazwa modułu`);
    if (typeof code !== 'string') {
      violations.push(`${name}: brak treści`);
      continue;
    }
    if (name === 'bin.mjs' && !code.startsWith('#!/usr/bin/env node')) violations.push('bin.mjs: brak shebang');
    const lines = code.split('\n').length;
    if (lines > MAX_MODULE_LINES) violations.push(`${name}: ${lines} linii > ${MAX_MODULE_LINES} — rozbij na moduły`);
    for (const [, a, b, c, d] of code.matchAll(IMPORT_RE)) {
      const spec = a || b || c || d;
      const sibling = spec.startsWith('./') && files[spec.slice(2)] !== undefined;
      if (!spec.startsWith('node:') && !sibling) violations.push(`${name}: import "${spec}" spoza node:* / modułów pakietu`);
    }
    for (const [re, label] of DENY) if (re.test(code)) violations.push(`${name}: ${label}`);
  }
  return violations;
}

// Uruchamia bin.mjs w zredukowanym env (bez sekretów) i sprawdza kontrakt wyjścia
export function contractTest(bin, exampleInput) {
  const env = { PATH: process.env.PATH, HOME: process.env.HOME || '/tmp', LANG: 'C.UTF-8' };
  let out;
  for (const payload of [{}, ...(exampleInput ? [exampleInput] : [])]) {
    const r = spawnSync('node', [bin], { input: JSON.stringify(payload), encoding: 'utf8', timeout: 25000, env });
    if (r.error) return { ok: false, error: `wykonanie: ${r.error.message}` };
    if (r.status !== 0) return { ok: false, error: `exit ${r.status}; stderr: ${(r.stderr || '').slice(0, 600)}` };
    try {
      out = JSON.parse(r.stdout.trim().split('\n').pop());
    } catch {
      return { ok: false, error: `stdout nie jest JSON: ${r.stdout.slice(0, 300)}` };
    }
    if (typeof out.ok !== 'boolean') return { ok: false, error: 'brak pola "ok" (boolean) w wyjściu' };
  }
  return { ok: true, output: out };
}

export const TEST_SOURCE = `import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const r = spawnSync('node', [fileURLToPath(new URL('./bin.mjs', import.meta.url))], { input: '{}', encoding: 'utf8', timeout: 25000 });
const out = JSON.parse(r.stdout.trim().split('\\n').pop());
if (r.status !== 0 || typeof out.ok !== 'boolean') process.exit(1);
console.log('✓ PASS');
`;
