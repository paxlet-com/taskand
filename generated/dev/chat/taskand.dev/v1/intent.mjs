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
  { name: 'composite', any: COMPLEXITY_SIGNALS },
  { name: 'telemetry', any: ['temperatur', 'temp', 'sprzęt', 'sprzet', 'cpu', 'procesor', 'pamięć', 'pamiec', 'dysk'] },
  { name: 'file-ops', all: [['plik'], ['istnieje', 'zawarto', 'czytaj', 'pokaż']] },
  { name: 'spawn-web', any: ['przeglądar', 'web', 'interfejs', 'gui', 'stron'] },
  { name: 'spawn-web', all: [['jak'], ['używa', 'uzywa']] },
  { name: 'diagnose', any: ['sprawdź', 'sprawdz', 'diagnoz', 'działa', 'status'] },
  { name: 'evolve-create', any: CREATE }
];

const hasAny = (low, words) => words.some(w => low.includes(w));

function matches(intent, text, low) {
  if (intent.re) return text.match(intent.re);
  if (intent.any) return hasAny(low, intent.any) ? [text] : null;
  return intent.all.every(group => hasAny(low, group)) ? [text] : null;
}

export function parseIntent(text) {
  const low = text.toLowerCase();
  for (const intent of INTENTS) {
    const match = matches(intent, text, low);
    if (match) return { name: intent.name, match, text };
  }
  return { name: 'query', match: [text], text };
}
