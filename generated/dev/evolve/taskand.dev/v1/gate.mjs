// Bramka regresji: nowa wersja musi być nie gorsza od wersji, którą zastępuje (na tym samym wejściu)
import { call } from './registry-client.mjs';

const CRASH = new Set(['EXEC_ERROR', 'CONTRACT_ERROR', 'OUTCOME_UNKNOWN', 'DENIED', 'NOT_FOUND']);
const clip = (v, n) => JSON.stringify(v).slice(0, n);

// Skrót wyjścia do oceny: pełne liczności tablic (także zagnieżdżonych o 1 poziom), wartości skalarne i próbki elementów.
// Surowy JSON obcięty do N znaków wprowadzał oceniającego w błąd („wynik ucięty”).
export function digest(output) {
  const counts = {};
  const samples = {};
  const scalars = {};
  const visit = (obj, prefix) => {
    for (const [k, v] of Object.entries(obj || {})) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (Array.isArray(v)) {
        counts[key] = v.length;
        samples[key] = v.slice(0, 5).map(x => clip(x, 300));
      } else if (v && typeof v === 'object') {
        if (!prefix) visit(v, key);
      } else if (!prefix) {
        scalars[key] = typeof v === 'string' ? v.slice(0, 300) : v;
      }
    }
  };
  visit(output, '');
  return { scalars, counts, samples };
}

// Deterministyczne porównanie liczności tablic — bez LLM, więc działa także bez klucza i nie myli się co do liczb.
// null = liczby nie rozstrzygają (brak wspólnych tablic albo wszystkie równe) → decyduje ocena LLM.
export function compareCounts(oldOutput, newOutput) {
  const before = digest(oldOutput).counts;
  const after = digest(newOutput).counts;
  const keys = Object.keys(before);
  if (!keys.length) return null;
  const diff = keys.map(k => ({ k, before: before[k], after: after[k] ?? 0 }));
  const fewer = diff.filter(d => d.after < d.before);
  const more = diff.filter(d => d.after > d.before);
  const fmt = ds => ds.map(d => `${d.k} ${d.after}≠${d.before}`).join(', ');
  if (fewer.length) return { verdict: 'worse', reason: `mniej danych niż poprzednia wersja: ${fmt(fewer)}` };
  if (more.length) return { verdict: 'better', reason: `więcej danych niż poprzednia wersja: ${fmt(more)}` };
  return null;
}

// verdict: better | equal | worse | unknown (unknown → pakiet zostaje candidate do przeglądu człowieka)
export function compare({ previous, capability, sampleInput, newOutput }) {
  const old = call(previous, sampleInput || {}, 60000);
  const oldBroken = CRASH.has(old.errorType);
  if (!newOutput.ok && (old.ok || !oldBroken)) return { verdict: 'worse', reason: `nowa wersja ok:false (${newOutput.error}), poprzednia działała`, previousOutput: old };
  if (oldBroken) return { verdict: newOutput.ok ? 'better' : 'equal', reason: `poprzednia wersja nie działa (${old.errorType}: ${old.error})`, previousOutput: old };

  // Najpierw liczby (deterministycznie), dopiero potem LLM — regresja liczności jest wychwytywana bez modelu
  const byCounts = compareCounts(old, newOutput);
  if (byCounts) return { ...byCounts, deterministic: true, previousOutput: old };

  const judge = call('proc://taskand.dev/dev/llm/v1', {
    system: `Porównujesz dwie wersje procesu realizującego tę samą zdolność na tym samym węźle i wejściu.
Oceń WYŁĄCZNIE kompletność i poprawność realnych danych względem zdolności (np. liczba wykrytych obiektów, brak pominiętych źródeł), nie styl.
Zwróć JSON: {"verdict": "better" | "equal" | "worse", "reason": "<1 zdanie, konkretne liczby>"}`,
    prompt: `Zdolność: ${capability}\n\nSkróty są kompletne: "counts" to PEŁNE długości tablic, "samples" to pierwsze elementy. Nie wnioskuj o obcięciu danych.\n\nPOPRZEDNIA WERSJA:\n${JSON.stringify(digest(old))}\n\nNOWA WERSJA:\n${JSON.stringify(digest(newOutput))}`,
    json: true,
    max_tokens: 600,
    temperature: 0
  }, 120000);
  if (!judge.ok || !['better', 'equal', 'worse'].includes(judge.json?.verdict)) {
    return { verdict: 'unknown', reason: `ocena niedostępna: ${judge.error || 'niepoprawny werdykt'}`, deterministic: false, previousOutput: old };
  }
  return { verdict: judge.json.verdict, reason: judge.json.reason, deterministic: false, previousOutput: old };
}
