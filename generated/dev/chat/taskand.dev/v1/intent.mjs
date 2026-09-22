// Tabela intencji dev/chat — nowa intencja = nowy wiersz (kolejność = priorytet)
// Normalizacja polskiej diakrytyki: ą→a, ę→e, ś→s, ź/ż→z, ć→c, ń→n, ó→o, ł→l
export const stripDiacritics = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0142/g, 'l').replace(/\u0141/g, 'L');

const COMPLEXITY_SIGNALS = [
  'zbuduj', 'stworz system', 'utworz system', 'skonfiguruj',
  'z alertami', 'z dashboardem', 'z powiadomieniami',
  'oraz', 'i potem', 'nastepnie', 'plus',
  'monitoring', 'automatyzuj', 'wdroz'
];
const CREATE = ['stworz', 'utworz', 'zrob'];

export const INTENTS = [
  { name: 'spawn-organism', re: /(?:stw[oó]rz|utw[oó]rz|powo[lł]aj|zbuduj|nowy)\s+organizm\s+([\p{L}0-9_-]+)(?:[\s,]+(?:kt[oó]ry|aby|[zż]eby)\s+(.+))?/iu },
  { name: 'twin', re: /digital\s*twin|cyfrow\w*\s+bli[źz]niak/iu },
  { name: 'query', all: [['skan', 'scan', 'wykryj', 'lista', 'pokaz'], ['siec', 'network', /\blan\b/, 'urzadze']] },
  { name: 'query', all: [['projekt', 'repo'], [/\bgit(hub)?\b/]] },
  { name: 'composite', any: COMPLEXITY_SIGNALS },
  { name: 'telemetry', any: ['temperatur', 'temp', 'sprzet', 'cpu', 'procesor', 'pamiec', 'dysk'] },
  { name: 'file-ops', all: [['plik'], ['istnieje', 'zawarto', 'czytaj', 'pokaz']] },
  // Subactor Account Twin queries
  { name: 'twin-account', re: /(?:bli[źz]niak\w*\s+konta|twin\s+konta|konta\s+w\s+twin|twin\s+(?:projekty|repozytoria|tickety|wdro[zż]enia|organizacje))/iu },
  { name: 'twin-account', all: [['twin', 'blizniak'], ['konto', 'subactor', 'organizacj', 'repozytor', 'ticket', 'wdrozen']] },
  // Subactor Ticket Lifecycle
  { name: 'ticket-lifecycle', re: /(?:uzgodnij|reconcile|preflight|sprawd[zź]\s+lifecycle|cykl\s+[zż]ycia)\s+(?:ticket[uów]*|zada[nń])/iu },
  { name: 'ticket-lifecycle', all: [['ticket', 'lifecycle'], ['uzgodn', 'reconcile', 'sprawdz', 'preflight', 'cykl']] },
  // Layer 1 Fast-Path matcher for browser actions (wellmanifest/nl-dsl-llm standard)
  { name: 'browser-action', re: /(?:kliknij|wci[sś]nij|naci[sś]nij|click|wpisz|wype[lł]nij|zrzut|screenshot|otw[oó]rz\s+stron|otworz\s+stron|nawiguj)\b.*?(?:https?:\/\/\S+|przycisk|button|link|pole|ekran|\bkarcie\b|\bstronie\b)/iu },
  { name: 'browser-action', all: [[/https?:\/\/\S+/], ['klikn', 'wcisn', 'nacisn', 'otworz', 'zrzut', 'screenshot', 'wpisz', 'wypeln']] },
  { name: 'spawn-web', all: [['web', 'cockpit', 'gui', 'panel'], ['status', 'uruchom', 'pokaz', 'dziala', 'link']] },
  { name: 'spawn-web', all: [['jak'], ['uzywa']] },
  { name: 'heal', any: ['napraw', 'wylecz', 'samonapraw'] },
  { name: 'prescribe', any: ['recept', 'zalece', 'co zrobic'] },
  { name: 'diagnose', any: ['sprawdz', 'diagnoz', 'dziala', 'status'] },
  { name: 'evolve-create', any: CREATE }
];

// Wejście przez organizm: aliasy organizmów wbudowanych → intencja; inne organizmy → własny <org>/chat
const DOCTOR = new Set(['doc', 'doctor']);
const DOCTOR_INTENTS = INTENTS.filter(i => ['heal', 'prescribe', 'diagnose'].includes(i.name));
const ORGANISM_INTENTS = {
  sec: 'vault', vault: 'vault',
  hw: 'telemetry',
  file: 'file-list',
  browser: 'browser',
  twin: 'twin'
};
const DEVELOPER = new Set(['', 'dev', 'developer', 'chat']);

// Słowa kluczowe: podciąg albo RegExp (granice słów, np. "lan" ≠ "plan", "git" ≠ "digital")
const hasAny = (low, words) => words.some(w => (typeof w === 'string' ? low.includes(w) : w.test(low)));

// Wzorce re akceptują obie pisownie i dostają oryginalny tekst: przechwycony opis zachowuje diakrytykę
function matches(intent, text, low) {
  if (intent.re) return text.match(intent.re);
  if (intent.any) return hasAny(low, intent.any) ? [text] : null;
  return intent.all.every(group => hasAny(low, group)) ? [text] : null;
}

export function parseIntent(text, organism = '') {
  const org = organism.toLowerCase();
  const low = stripDiacritics(text).toLowerCase();
  if (DOCTOR.has(org)) return { name: DOCTOR_INTENTS.find(i => matches(i, text, low))?.name || 'diagnose', match: [text], text, organism: org };
  if (ORGANISM_INTENTS[org]) return { name: ORGANISM_INTENTS[org], match: [text], text, organism: org };
  if (!DEVELOPER.has(org)) return { name: 'organism', match: [text], text, organism: org };
  for (const intent of INTENTS) {
    const match = matches(intent, text, low);
    if (match) return { name: intent.name, match, text, organism: 'dev' };
  }
  return { name: 'query', match: [text], text, organism: 'dev' };
}

export function parseBrowserAction(text) {
  const urlMatch = text.match(/https?:\/\/[^\s<>"']+/);
  const url = urlMatch ? urlMatch[0] : undefined;

  // Click extraction
  const clickMatch = text.match(/(?:kliknij|wci[sś]nij|naci[sś]nij|click)\s+(?:w\s+|na\s+)?(?:przycisk\s+|button\s+|link\s+)?["'„”]?([^"'„”\n,]+?)["'„”]?(\s+(?:na\s+stronie|w\s+oknie|na|w|pod\s+adresem)\b|\s*$)/iu);
  if (clickMatch && clickMatch[1] && !/^(stron|ekran|okno|buttony|przyciski)/i.test(clickMatch[1].trim())) {
    const rawTarget = clickMatch[1].trim().replace(/^na\s+/i, '').replace(/^przycisk\s+/i, '');
    const prefix = text.slice(0, (clickMatch.index || 0) + clickMatch[0].length);
    const isButton = /(?:przycisk|button)\b/iu.test(prefix);
    const isLink = /(?:link|odno[sś]nik)\b/iu.test(prefix);
    const role = isButton ? 'button' : (isLink ? 'link' : undefined);
    return { action: 'click', text: rawTarget, role, url };
  }

  // Fill extraction
  const fillMatch = text.match(/(?:wpisz|wype[lł]nij|set)\s+["'„”]?([^"'„”]+)["'„”]?\s+(?:w|do)\s+(?:pole\s+)?["'„”]?([^"'„”]+)["'„”]?/iu);
  if (fillMatch) {
    return { action: 'fill', value: fillMatch[1].trim(), text: fillMatch[2].trim(), url };
  }

  // Screenshot extraction
  if (/zrzut|screenshot|zrzuc\s+ekran/iu.test(text)) {
    const fileMatch = text.match(/(?:do\s+pliku|jako|zapisz\s+w)\s+(\S+\.png)/i);
    return { action: 'screenshot', output: fileMatch ? fileMatch[1] : undefined, url };
  }

  // Open / navigate
  if (url) {
    return { action: 'open', url };
  }

  return { action: 'status' };
}
