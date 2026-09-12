#!/usr/bin/env node
// proc://taskand.dev/admin/chat/v1 — organizm admin: deleguje każde zadanie do dev/act (wybór procesu z katalogu lub ewolucja)
import { readInput, emit, callProc } from '../../../../_lib/proc.mjs';

const input = readInput();
const message = input.message || input.prompt || '';
if (!message) emit({ ok: true, organism: 'admin', reply: '[admin] Gotowy. Podaj zadanie.' });
const r = callProc('proc://taskand.dev/dev/act/v1', { organism: 'admin', message }, { timeout: 600000 });
emit({ ok: r.ok !== false, organism: 'admin', reply: r.reply || r.error, action: r.action, uri: r.uri });
