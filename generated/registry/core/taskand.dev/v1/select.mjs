// Reuse is deterministic: select the newest active version, then verify its binding.
import { allEntries } from './store.mjs';
import { resolve } from './exec.mjs';

export function select({ organism, capability }) {
  if (![organism, capability].every(s => /^[a-z0-9][a-z0-9-]*$/.test(s || ''))) {
    return { ok: false, errorType: 'NOT_FOUND', error: 'Wymagane: organism i capability (nazwy URI)' };
  }
  const prefix = `proc://taskand.dev/${organism}/${capability}/v`;
  const candidates = allEntries().filter(e => e.status === 'active' && e.uri.startsWith(prefix))
    .sort((a, b) => Number(b.uri.slice(prefix.length)) - Number(a.uri.slice(prefix.length)));
  if (!candidates.length) return { ok: false, errorType: 'NOT_FOUND', error: `Brak aktywnej zdolności: ${prefix}<N>` };
  // A damaged newest version is an error; do not silently downgrade.
  const result = resolve(candidates[0].uri);
  return { ...result, ...(result.ok ? { uri: result.entry.uri, reused: true } : {}) };
}
