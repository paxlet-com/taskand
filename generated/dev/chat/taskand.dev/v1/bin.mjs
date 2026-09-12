#!/usr/bin/env node
// proc://taskand.dev/dev/chat/v1 — developer taskand v2.2: prompt → intencja → dispatch do procesu
// Intencje: ./intent.mjs (tabela), routing: ./dispatch.mjs, LLM: dev/llm, ewolucja: dev/act + dev/evolve
import { readInput, emit } from '../../../../_lib/proc.mjs';
import { parseIntent } from './intent.mjs';
import { dispatch } from './dispatch.mjs';

const input = readInput();
const prompt = input.message || input.prompt || 'status';
const intent = parseIntent(prompt);

try {
  emit({ ok: true, intent: intent.name, reply: await dispatch(intent) });
} catch (err) {
  emit({ ok: false, intent: intent.name, reply: `[developer] ✗ ${err.message}` }, 1);
}
