import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildDeliveryPlan, deliver, parseDeliveryArgs } from './delivery.mjs';

function repoFixture() {
  const root = mkdtempSync(join(tmpdir(), 'taskand-delivery-'));
  writeFileSync(join(root, 'marker'), 'fixture\n');
  return root;
}

function observation(root) {
  return { root, repository: 'semcod/example', branch: 'ticket-branch', head: 'a'.repeat(40), base: 'b'.repeat(40), dirtyPaths: 1 };
}

test('plan mode is read-only and rejects effect escalation without required gates', () => {
  assert.equal(parseDeliveryArgs(['--ticket', 'ticket-007']).pullRequest, false);
  assert.throws(() => parseDeliveryArgs(['--ticket', 'ticket-007', '--merge']), /MERGE_REQUIRES/);
  assert.throws(() => parseDeliveryArgs(['--ticket', 'ticket-007', '--pull-request', '--wait']), /KEY_FILE_REQUIRED/);
});

test('plan includes the delegated pipeline and no direct merge command', () => {
  const root = repoFixture();
  try {
    const plan = buildDeliveryPlan(parseDeliveryArgs(['--ticket', 'ticket-007']), observation(root));
    assert.deepEqual(plan.commands.map(c => c.name), ['queue', 'goal', 'discover-pr']);
    assert.equal(plan.commands.some(c => c.args.includes('merge')), false);
    assert.equal(plan.gates.protectedValidator, false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('plan persists state atomically and resumes as an idempotent plan', () => {
  const root = repoFixture();
  const stateDir = mkdtempSync(join(tmpdir(), 'taskand-state-'));
  try {
    const args = ['--ticket', 'ticket-007', '--state-dir', stateDir];
    const deps = { observe: () => ({ ...observation(root), ticketPath: join(root, 'project/ticket-007/README.md') }) };
    const first = deliver(args, deps);
    assert.equal(first.status, 'BLOCKED');
    mkdirSync(join(root, 'project/ticket-007'), { recursive: true });
    writeFileSync(join(root, 'project/ticket-007/README.md'), '**Status**: IN_PROGRESS\n');
    const second = deliver(args, deps);
    assert.equal(second.status, 'PLAN_READY');
    assert.equal(readFileSync(second.stateFile, 'utf8').includes('taskand.delivery-controller/v1'), true);
    const third = deliver(args, deps);
    assert.equal(third.status, 'PLAN_READY');
    assert.equal(third.resumed, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(stateDir, { recursive: true, force: true });
  }
});

test('effect mode orders Koru, Goal, PR discovery and protected Validator', () => {
  const root = repoFixture();
  const stateDir = mkdtempSync(join(tmpdir(), 'taskand-state-'));
  mkdirSync(join(root, 'project/ticket-007'), { recursive: true });
  writeFileSync(join(root, 'project/ticket-007/README.md'), '**Status**: IN_PROGRESS\n');
  const calls = [];
  try {
    const result = deliver(['--ticket', 'ticket-007', '--pull-request', '--wait', '--key-file', '/protected/key.pem', '--state-dir', stateDir], {
      observe: () => observation(root),
      runCommand: command => {
        calls.push(command);
        if (command.name === 'discover-pr') return { ok: true, exitCode: 0, result: [{ number: 42, headRefName: 'ticket-branch', headRefOid: 'a'.repeat(40), url: 'https://github.com/semcod/example/pull/42' }] };
        return { ok: true, exitCode: 0, result: null };
      }
    });
    assert.equal(result.status, 'REVIEWED');
    assert.deepEqual(calls.map(c => c.name), ['queue', 'goal', 'discover-pr', 'validator']);
    assert.equal(calls[3].args.includes('--apply'), true);
    assert.equal(calls[3].args.includes('--merge'), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(stateDir, { recursive: true, force: true });
  }
});

test('pull-request mode stops after PR discovery and does not require Validator credentials', () => {
  const root = repoFixture();
  const stateDir = mkdtempSync(join(tmpdir(), 'taskand-state-'));
  mkdirSync(join(root, 'project/ticket-007'), { recursive: true });
  writeFileSync(join(root, 'project/ticket-007/README.md'), '**Status**: IN_PROGRESS\n');
  const calls = [];
  try {
    const result = deliver(['--ticket', 'ticket-007', '--pull-request', '--state-dir', stateDir], {
      observe: () => observation(root),
      runCommand: command => {
        calls.push(command);
        if (command.name === 'discover-pr') return { ok: true, exitCode: 0, result: [{ number: 44, headRefName: 'ticket-branch', headRefOid: 'a'.repeat(40) }] };
        return { ok: true, exitCode: 0, result: null };
      }
    });
    assert.equal(result.status, 'PR_READY');
    assert.deepEqual(calls.map(c => c.name), ['queue', 'goal', 'discover-pr']);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(stateDir, { recursive: true, force: true });
  }
});

test('merge requires and passes the protected Validator merge gate', () => {
  const root = repoFixture();
  const stateDir = mkdtempSync(join(tmpdir(), 'taskand-state-'));
  mkdirSync(join(root, 'project/ticket-007'), { recursive: true });
  writeFileSync(join(root, 'project/ticket-007/README.md'), '**Status**: IN_PROGRESS\n');
  const calls = [];
  try {
    const result = deliver(['--ticket', 'ticket-007', '--pull-request', '--wait', '--merge', '--key-file', '/protected/key.pem', '--state-dir', stateDir], {
      observe: () => observation(root),
      runCommand: command => {
        calls.push(command);
        if (command.name === 'discover-pr') return { ok: true, exitCode: 0, result: [{ number: 43, headRefName: 'ticket-branch', headRefOid: 'a'.repeat(40) }] };
        return { ok: true, exitCode: 0, result: null };
      }
    });
    assert.equal(result.status, 'MERGED');
    assert.equal(calls.at(-1).args.includes('--merge'), true);
    assert.equal(calls.at(-1).args.includes('--expected-head-sha'), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(stateDir, { recursive: true, force: true });
  }
});
