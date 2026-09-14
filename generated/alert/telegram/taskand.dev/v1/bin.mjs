#!/usr/bin/env node
// proc://taskand.dev/alert/telegram/v1 — alert CPU na Telegram: realna wysyłka przez Bot API.
// Token wyłącznie z brokera (credentialRef → TASKAND_CREDENTIAL). Limit: 1 alert / 5 min na chat.
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let input;
try {
  const raw = readFileSync(0, 'utf8').trim();
  input = raw ? JSON.parse(raw) : {};
} catch {
  process.exit(2);
}

// AbortSignal.timeout nie podtrzymuje pętli zdarzeń — bez tego zawieszone połączenie kończy proces kodem 13 bez wyjścia
setInterval(() => {}, 60000);
const params = input.params || {};
const emit = out => {
  process.stdout.write(JSON.stringify({ channel: 'telegram', ...out, ts: new Date().toISOString() }) + '\n');
  process.exit(0);
};
if (params.token || params.bot_token) emit({ ok: false, error: 'Jawny token w params jest zabroniony — użyj credentialRef: vault://telegram/token' });

const cpu = Object.values(input.dependencies || {}).map(d => d?.cpu_pct).find(v => typeof v === 'number') ?? input.cpu_pct;
if (typeof cpu !== 'number') emit({ ok: false, error: 'Brak pomiaru cpu_pct (z zależności lub wejścia)' });

const threshold = Number(params.threshold ?? 80);
if (cpu < threshold) emit({ ok: true, triggered: false, value: cpu, threshold, status: 'THRESHOLD_NOT_EXCEEDED', summary: `CPU ${cpu}% < próg ${threshold}% — bez alertu` });

const token = process.env.TASKAND_CREDENTIAL;
const chatId = params.chat_id;
if (!token) emit({ ok: false, triggered: true, value: cpu, threshold, error: `Próg przekroczony, ale brak poświadczenia: ${process.env.TASKAND_CREDENTIAL_ERROR || 'podaj credentialRef'}` });
if (!chatId) emit({ ok: false, triggered: true, value: cpu, threshold, error: 'Próg przekroczony, ale brak params.chat_id' });

const RATE_MS = 5 * 60 * 1000;
const stamp = join(tmpdir(), `taskand-telegram-${String(chatId).replace(/\W/g, '_')}.last`);
let last = 0;
try {
  last = Number(readFileSync(stamp, 'utf8'));
} catch {}
if (Date.now() - last < RATE_MS) emit({ ok: true, triggered: true, value: cpu, threshold, status: 'RATE_LIMITED', summary: `Alert pominięty — limit 1 / 5 min (ostatni ${new Date(last).toISOString()})` });

const text = `🚨 CPU ${cpu}% ≥ ${threshold}% na węźle ${params.device || 'taskand'}`;
try {
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
    signal: AbortSignal.timeout(10000)
  });
  const body = await r.json();
  if (!body.ok) emit({ ok: false, triggered: true, value: cpu, threshold, error: `Telegram API: ${body.description}` });
  writeFileSync(stamp, String(Date.now()));
  emit({ ok: true, triggered: true, value: cpu, threshold, status: 'ALERT_SENT', message_id: body.result.message_id, summary: text });
} catch (err) {
  emit({ ok: false, triggered: true, value: cpu, threshold, error: `Telegram: ${err.message}` });
}
