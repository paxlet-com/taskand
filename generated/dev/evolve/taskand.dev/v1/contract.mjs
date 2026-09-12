// Kontrakt procesu taskand: prompt generatora, guard statyczny, test kontraktu
import { spawnSync } from 'node:child_process';

export const SYSTEM = `Jesteś generatorem procesów systemu taskand v2.2. Piszesz JEDEN plik bin.mjs.

KONTRAKT (obowiązkowy):
- Node.js >= 18, ESM, pierwsza linia: #!/usr/bin/env node
- Tylko moduły wbudowane "node:*" (brak npm).
- Wejście: jeden obiekt JSON na stdin (może być pusty "{}"). Niepoprawny JSON → process.exit(2).
- Wyjście: DOKŁADNIE jedna linia JSON na stdout z polem "ok" (boolean), potem process.exit(0).
- Dla wejścia "{}" wykonaj domyślną, bezpieczną akcję tylko do odczytu i zwróć realne dane.
- Pole "summary": jedno zdanie po polsku z wynikiem dla człowieka.

PRAWDOMÓWNOŚĆ:
- Zwracaj WYŁĄCZNIE dane zmierzone/odczytane w czasie wykonania. Zero wartości zmyślonych, domyślnych czy przykładowych.
- Jeśli narzędzie (np. nmap) jest niedostępne, spróbuj alternatyw (np. ip neigh, /proc/net/arp, arp -a, odczyt /sys, /proc).
- Gdy wynik jest niemożliwy do uzyskania: {"ok": false, "error": "<powód>"} i exit 0.

BEZPIECZEŃSTWO:
- Tylko odczyt. Żadnego usuwania/modyfikacji plików poza os.tmpdir(), żadnego sudo, instalacji pakietów, restartów.
- Każde child_process: timeout <= 15000 ms, stdio przechwycone. Całość musi skończyć się w < 20 s.
- Nie wysyłaj danych do zewnętrznych hostów. Nie czytaj zmiennych środowiskowych z sekretami.

Zwróć WYŁĄCZNIE JSON: {"description": "<1 zdanie: co robi proces>", "code": "<pełna treść bin.mjs>"}`;

const DENY = [
  [/\brm\s+-[a-z]*r/i, 'rm -r'],
  [/\bsudo\b/, 'sudo'],
  [/\bmkfs|\bdd\s+if=|>\s*\/dev\/sd/, 'operacja na dysku'],
  [/\b(shutdown|reboot|poweroff|halt)\b/, 'zarządzanie zasilaniem'],
  [/\b(apt|apt-get|apk|yum|dnf|pip|npm)\s+(install|add)\b/, 'instalacja pakietów'],
  [/(curl|wget)[^\n|]*\|\s*(ba)?sh/, 'pipe do shella'],
  [/\b(unlinkSync|rmSync|rmdirSync|unlink|rm)\s*\(/, 'usuwanie plików'],
  [/TASKAND_[A-Z_]*(KEY|TOKEN|SECRET)/, 'odczyt sekretów taskand'],
  [/\beval\s*\(|new Function\s*\(/, 'eval']
];

export function guard(code) {
  if (!code.startsWith('#!/usr/bin/env node')) return 'brak shebang #!/usr/bin/env node';
  if (/\bfrom\s+['"](?!node:)[^'"./][^'"]*['"]/.test(code) || /require\(/.test(code)) return 'import spoza node:*';
  const hit = DENY.find(([re]) => re.test(code));
  return hit ? hit[1] : null;
}

// Uruchamia proces w zredukowanym środowisku (bez sekretów) i sprawdza kontrakt wyjścia
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
