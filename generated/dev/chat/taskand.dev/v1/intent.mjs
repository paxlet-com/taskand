// Tabela intencji dev/chat — nowa intencja = nowy wiersz (kolejność = priorytet)
const COMPLEXITY_SIGNALS = [
  'zbuduj', 'stwórz system', 'utwórz system', 'skonfiguruj',
  'z alertami', 'z dashboardem', 'z powiadomieniami',
  'oraz', 'i potem', 'następnie', 'plus',
  'monitoring', 'automatyzuj', 'wdroż'
];
const CREATE = ['stwórz', 'stworz', 'utwórz', 'utworz', 'zrób', 'zrob'];

export const INTENTS = [
  { name: 'spawn-organism', re: /(?:stwórz|stworz|utwórz|utworz|powołaj|powolaj|zbuduj|nowy)\s+organizm\s+([\p{L}0-9_-]+)(?:[\s,]+(?:który|ktory|aby|żeby|zeby)\s+(.+))?/iu },
  { name: 'twin', re: /digital\s*twin|cyfrow\w*\s+bli[źz]niak/iu },
  { name: 'query', all: [['skan', 'scan', 'wykryj'], ['sieć', 'sieci', 'siec', 'network', 'lan']] },
  { name: 'composite', any: COMPLEXITY_SIGNALS },
  { name: 'telemetry', any: ['temperatur', 'temp', 'sprzęt', 'sprzet', 'cpu', 'procesor', 'pamięć', 'pamiec', 'dysk'] },
  { name: 'file-ops', all: [['plik'], ['istnieje', 'zawarto', 'czytaj', 'pokaż']] },
  { name: 'spawn-web', any: ['przeglądar', 'web', 'interfejs', 'gui', 'stron'] },
  { name: 'spawn-web', all: [['jak'], ['używa', 'uzywa']] },
  { name: 'heal', any: ['napraw', 'wylecz', 'samonapraw'] },
  { name: 'prescribe', any: ['recept', 'zalece', 'co zrobić', 'co zrobic'] },
  { name: 'diagnose', any: ['sprawdź', 'sprawdz', 'diagnoz', 'działa', 'status'] },
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

const hasAny = (low, words) => words.some(w => low.includes(w));

function matches(intent, text, low) {
  if (intent.re) return text.match(intent.re);
  if (intent.any) return hasAny(low, intent.any) ? [text] : null;
  return intent.all.every(group => hasAny(low, group)) ? [text] : null;
}

export function parseIntent(text, organism = '') {
  const org = organism.toLowerCase();
  if (DOCTOR.has(org)) return { name: DOCTOR_INTENTS.find(i => matches(i, text, text.toLowerCase()))?.name || 'diagnose', match: [text], text, organism: org };
  if (ORGANISM_INTENTS[org]) return { name: ORGANISM_INTENTS[org], match: [text], text, organism: org };
  if (!DEVELOPER.has(org)) return { name: 'organism', match: [text], text, organism: org };
  const low = text.toLowerCase();
  for (const intent of INTENTS) {
    const match = matches(intent, text, low);
    if (match) return { name: intent.name, match, text, organism: 'dev' };
  }
  return { name: 'query', match: [text], text, organism: 'dev' };
}
