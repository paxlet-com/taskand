#!/usr/bin/env node
// proc://taskand.dev/browser/session/v1 — sterowanie przeglądarką digital twin przez Chrome DevTools Protocol (HTTP API)
// in: { action: status|open|list|close, url?, id? }   env: TASKAND_BROWSER_CDP (domyślnie http://localhost:9222)
import { readFileSync } from 'node:fs';

let input;
try {
  const raw = readFileSync(0, 'utf8').trim();
  input = raw ? JSON.parse(raw) : {};
} catch {
  process.exit(2);
}

// AbortSignal.timeout nie podtrzymuje pętli zdarzeń — bez tego zawieszone połączenie kończy proces kodem 13 bez wyjścia
setInterval(() => {}, 60000);
const CDP = (process.env.TASKAND_BROWSER_CDP || 'http://localhost:9222').replace(/\/$/, '');
const NOVNC = process.env.TASKAND_BROWSER_NOVNC || 'http://localhost:3010';
const action = input.action || (input.url ? 'open' : 'status');
const emit = out => {
  process.stdout.write(JSON.stringify({ action, cdp: CDP, novnc_url: NOVNC, ...out, ts: new Date().toISOString() }) + '\n');
  process.exit(0);
};

async function cdp(path, method = 'GET') {
  const r = await fetch(`${CDP}${path}`, { method, signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`CDP ${path}: HTTP ${r.status}`);
  const text = await r.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const tabs = async () => (await cdp('/json/list')).filter(t => t.type === 'page').map(({ id, title, url }) => ({ id, title, url }));

const ACTIONS = {
  status: async () => {
    const v = await cdp('/json/version');
    return { ok: true, browser: v.Browser, tabs: (await tabs()).length, summary: `${v.Browser} gotowa, podgląd: ${NOVNC}` };
  },
  list: async () => ({ ok: true, tabs: await tabs() }),
  open: async () => {
    if (!/^https?:\/\//.test(input.url || '')) return { ok: false, error: 'Wymagane: url (http/https)' };
    const tab = await cdp(`/json/new?${encodeURI(input.url)}`, 'PUT');
    return { ok: true, session: `session://browser/${tab.id}`, id: tab.id, url: input.url, summary: `Otwarto ${input.url} — podgląd: ${NOVNC}` };
  },
  close: async () => {
    if (!input.id) return { ok: false, error: 'Wymagane: id karty' };
    await cdp(`/json/close/${encodeURIComponent(input.id)}`);
    return { ok: true, id: input.id, closed: true };
  }
};

if (!ACTIONS[action]) emit({ ok: false, error: `Nieznana akcja "${action}"` });
try {
  emit(await ACTIONS[action]());
} catch (err) {
  emit({ ok: false, error: `Przeglądarka niedostępna przez CDP (${CDP}): ${err.cause?.code || err.message}. Wymaga vm-browser z CHROME_CLI=--remote-debugging-port=9222.` });
}
