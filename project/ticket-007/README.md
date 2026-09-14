# Ticket 007: Unified resumable delivery controller for Taskand

- **ID**: ticket-007
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: PUBLICATION
- **Created**: 2026-09-14

## Goal and scope

SESSION_EXECUTION_AUTHORIZATION, 2026-09-14: the user requested execution of
the Taskand → Koru → Goal → Validator delivery design. This ticket implements
the bounded local coordinator only. It keeps plan mode read-only, persists an
idempotent recovery record outside Git, and exposes explicit
`taskand deliver --pull-request` and `--merge` gates. It delegates queue,
commit/PR and protected approval/merge to the existing tools; it does not
reimplement or bypass them.

The primary checkout contains unrelated untracked ticket-003 documents and is
not used. This implementation is isolated in the managed
`.worktrees/ticket-007--delivery-controller` worktree. No production service,
secret, repository visibility, branch protection or hosted CI configuration is
changed by this ticket.

Budget decision: S / three implementation files / two components / no runtime
dependencies. The regression test lives under the existing integration-owned
`operations/**` contract and does not modify the shared governance manifest.

## Acceptance criteria

- [ ] AC-01: `taskand deliver --ticket ticket-NNN` creates a read-only plan and
  durable idempotency state without invoking Koru, Goal or Validator.
- [ ] AC-02: `--pull-request` executes the existing Koru and Goal adapters in
  order, discovers the exact PR/head, and can resume from the persisted state
  without repeating a terminal step.
- [ ] AC-03: `--merge` is fail-closed unless `--pull-request --wait --key-file`
  are present and invokes the exact-head protected Validator; no direct GitHub
  merge is implemented.
- [ ] AC-04: Unit tests cover argument safety, atomic state, resume and command
  ordering; managed governance and stack checks pass.

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
