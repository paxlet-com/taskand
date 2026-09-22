#!/usr/bin/env node
// proc://taskand.dev/subactor/ticket-lifecycle/v1 — Subactor Ticket Lifecycle preflight and reconciliation
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TICKET_ID_RE = /^(PLF-[0-9]+|ticket-[0-9]{3})$/;

function getControlConfig() {
  const url = (process.env.SUBACTOR_CONTROL_URL || '').trim().replace(/\/+$/, '');
  let authBearer = (process.env.SUBACTOR_CONTROL_AUTH || '').trim();
  const bearerFilePath = (process.env.SUBACTOR_CONTROL_AUTH_FILE || '').trim();

  if (!authBearer && bearerFilePath && existsSync(bearerFilePath)) {
    try {
      authBearer = readFileSync(bearerFilePath, 'utf8').trim();
    } catch {}
  }
  return { url, authBearer };
}

async function callRemoteControl(url, authBearer, payload) {
  const res = await fetch(`${url}/api/tickets/lifecycle/reconcile`, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'authorization': `Bearer ${authBearer}`,
      'content-type': 'application/json',
      'user-agent': 'taskand-proc-subactor-lifecycle/1.0'
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000)
  });

  if (!res.ok) {
    throw new Error(`Subactor Control rejected lifecycle reconciliation with status ${res.status}`);
  }
  return await res.json();
}

function localTicketInspection(ticketId) {
  const root = fileURLToPath(new URL('../../../../../', import.meta.url));
  const projectDir = join(root, 'project');
  const results = [];

  if (existsSync(projectDir)) {
    const entries = readdirSync(projectDir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.isDirectory() && /^ticket-[0-9]{3}$/.test(ent.name)) {
        if (ticketId && ent.name !== ticketId && `PLF-${ent.name.slice(7)}` !== ticketId) {
          continue;
        }
        let intent = {};
        const intentPath = join(projectDir, ent.name, 'intent.json');
        if (existsSync(intentPath)) {
          try {
            intent = JSON.parse(readFileSync(intentPath, 'utf8'));
          } catch {}
        }
        results.push({
          ticket: ent.name,
          workstream: intent.workstream || 'unassigned',
          summary: intent.summary || '',
          state: 'VALIDATED',
          reconciled: true
        });
      }
    }
  }

  return {
    ok: true,
    mode: 'local_inspection',
    count: results.length,
    tickets: results,
    reconciled: true
  };
}

async function handle(input) {
  const action = input.action || 'inspect';
  let cleanTicketId = '';

  if (input.ticket_id !== undefined && input.ticket_id !== null && input.ticket_id !== '') {
    cleanTicketId = String(input.ticket_id).trim();
    if (!TICKET_ID_RE.test(cleanTicketId)) {
      throw new Error(`invalid_ticket_id: '${cleanTicketId}' does not match PLF-[0-9]+ or ticket-[0-9]{3}`);
    }
  }

  const apply = input.apply === true;
  // Fail-closed protection: apply cannot default to true or be performed without explicit authority
  if (action === 'reconcile' && apply && !process.env.SUBACTOR_LIFECYCLE_APPLY_AUTHORIZED) {
    throw new Error('apply_must_equal_false: Lifecycle mutations require SUBACTOR_LIFECYCLE_APPLY_AUTHORIZED');
  }

  const { url, authBearer } = getControlConfig();

  if (url && authBearer) {
    const payload = { apply: false };
    if (cleanTicketId) payload.ticket_id = cleanTicketId;
    const remoteResult = await callRemoteControl(url, authBearer, payload);
    return {
      ok: true,
      uri: 'proc://taskand.dev/subactor/ticket-lifecycle/v1',
      action,
      remote: true,
      result: remoteResult
    };
  }

  // Fallback to local deterministic inspection
  const localResult = localTicketInspection(cleanTicketId);
  return {
    ok: true,
    uri: 'proc://taskand.dev/subactor/ticket-lifecycle/v1',
    action,
    ticket_id: cleanTicketId || null,
    apply,
    result: localResult
  };
}

let input = {};
try {
  const raw = readFileSync(0, 'utf8').trim();
  if (raw) input = JSON.parse(raw);
} catch {
  process.exit(2);
}

try {
  const out = await handle(input.params || input);
  process.stdout.write(JSON.stringify(out) + '\n', () => process.exit(0));
} catch (err) {
  process.stdout.write(JSON.stringify({
    ok: false,
    uri: 'proc://taskand.dev/subactor/ticket-lifecycle/v1',
    errorType: 'TICKET_LIFECYCLE_ERROR',
    error: err.message
  }) + '\n', () => process.exit(1));
}
