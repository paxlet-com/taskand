#!/usr/bin/env node
// proc://taskand.dev/dev/llm/v1 — jedyny klient LLM (Z.ai / OpenAI-compatible)
// in:  { system?, prompt? | messages?, json?: bool, max_tokens?, temperature?, reasoning_effort?: low|high|max }
// out: { ok, content, json? } | { ok:false, error }
import { readFileSync } from 'node:fs';

let input;
try {
  const raw = readFileSync(0, 'utf8').trim();
  input = raw ? JSON.parse(raw) : {};
} catch {
  process.exit(2);
}
const emit = out => {
  process.stdout.write(JSON.stringify(out) + '\n');
  process.exit(0);
};
// AbortSignal.timeout nie podtrzymuje pętli zdarzeń — bez tego zawieszone połączenie kończy proces kodem 13 bez wyjścia
setInterval(() => {}, 60000);
const KEY = process.env.TASKAND_LLM_API_KEY;
const MODEL = process.env.TASKAND_LLM_MODEL || 'glm-5.3';
const URL = process.env.TASKAND_LLM_ENDPOINT || 'https://api.z.ai/api/paas/v4/chat/completions';

const messages = input.messages || [
  ...(input.system ? [{ role: 'system', content: input.system }] : []),
  ...(input.prompt ? [{ role: 'user', content: input.prompt }] : [])
];

if (messages.length === 0) emit({ ok: false, error: 'Brak prompt/messages', model: MODEL, configured: Boolean(KEY) });
if (!KEY) emit({ ok: false, error: 'LLM_UNAVAILABLE: brak TASKAND_LLM_API_KEY' });

// Wyciąga pierwszy obiekt JSON z odpowiedzi (także z bloku ```json)
function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

try {
  const resp = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_tokens: input.max_tokens || 1500,
      temperature: input.temperature ?? 0.2,
      // GLM-5.x zawsze rozumuje; reasoning zużywa max_tokens, więc domyślnie "low"
      reasoning_effort: input.reasoning_effort || process.env.TASKAND_LLM_REASONING || 'low'
    }),
    signal: AbortSignal.timeout(input.timeout_ms || 90000)
  });
  const data = await resp.json();
  const choice = data.choices?.[0];
  const content = choice?.message?.content;
  if (!resp.ok || !content) {
    emit({ ok: false, error: `LLM HTTP ${resp.status}: ${data.error?.message || `pusta treść (finish_reason=${choice?.finish_reason}, usage=${JSON.stringify(data.usage)})`}` });
  }
  if (!input.json) emit({ ok: true, content });
  const json = extractJson(content);
  emit(json ? { ok: true, content, json } : { ok: false, error: 'LLM nie zwrócił poprawnego JSON', content });
} catch (err) {
  emit({ ok: false, error: `LLM: ${err.message}` });
}
