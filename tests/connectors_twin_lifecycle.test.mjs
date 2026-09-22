import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { parseIntent } from '../generated/dev/chat/taskand.dev/v1/intent.mjs';

const runProc = (binPath, input) => {
  const r = spawnSync('node', [binPath], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    timeout: 10000
  });
  return {
    status: r.status,
    data: JSON.parse(r.stdout || '{}'),
    stderr: r.stderr
  };
};

test('proc://taskand.dev/twin/account/v1 queries resources and handles bounded parameters', () => {
  const bin = 'generated/twin/account/taskand.dev/v1/bin.mjs';

  // Summary query
  const res1 = runProc(bin, { action: 'summary' });
  assert.equal(res1.status, 0);
  assert.equal(res1.data.ok, true);
  assert.equal(res1.data.resource, 'summary');
  assert.ok(res1.data.result);

  // Repositories query with valid filter
  const res2 = runProc(bin, { action: 'repositories', organization: 'subactor' });
  assert.equal(res2.status, 0);
  assert.equal(res2.data.ok, true);
  assert.equal(res2.data.resource, 'repositories');

  // Rejection of invalid filter with control characters
  const res3 = runProc(bin, { action: 'repositories', organization: 'bad\u0000org' });
  assert.equal(res3.status, 1);
  assert.equal(res3.data.ok, false);
  assert.equal(res3.data.errorType, 'TWIN_QUERY_FAILED');
  assert.match(res3.data.error, /Invalid filter parameter/);
});

test('proc://taskand.dev/subactor/ticket-lifecycle/v1 inspects tickets and enforces fail-closed apply', () => {
  const bin = 'generated/subactor/ticket-lifecycle/taskand.dev/v1/bin.mjs';

  // Inspect all tickets
  const res1 = runProc(bin, { action: 'inspect' });
  assert.equal(res1.status, 0);
  assert.equal(res1.data.ok, true);
  assert.equal(res1.data.action, 'inspect');
  assert.ok(res1.data.result.count >= 1);

  // Inspect specific ticket-043
  const res2 = runProc(bin, { action: 'inspect', ticket_id: 'ticket-043' });
  assert.equal(res2.status, 0);
  assert.equal(res2.data.ok, true);
  assert.equal(res2.data.result.count, 1);
  assert.equal(res2.data.result.tickets[0].ticket, 'ticket-043');

  // Invalid ticket ID format
  const res3 = runProc(bin, { action: 'inspect', ticket_id: 'invalid-id-format' });
  assert.equal(res3.status, 1);
  assert.equal(res3.data.ok, false);
  assert.match(res3.data.error, /invalid_ticket_id/);

  // Unauthorized apply=true fails closed
  const res4 = runProc(bin, { action: 'reconcile', apply: true });
  assert.equal(res4.status, 1);
  assert.equal(res4.data.ok, false);
  assert.match(res4.data.error, /apply_must_equal_false/);
});

test('natural language intents match twin-account and ticket-lifecycle requests', () => {
  const t1 = parseIntent('pokaż stan bliźniaka konta');
  assert.equal(t1.name, 'twin-account');

  const t2 = parseIntent('pokaz repozytoria w twinie subactor');
  assert.equal(t2.name, 'twin-account');

  const t3 = parseIntent('sprawdź lifecycle ticketu ticket-043');
  assert.equal(t3.name, 'ticket-lifecycle');

  const t4 = parseIntent('uzgodnij cykl życia ticketów');
  assert.equal(t4.name, 'ticket-lifecycle');
});
