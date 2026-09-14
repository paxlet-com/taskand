# Ticket 010: Verified gateway identity and remaining local acceptance

- **ID**: ticket-010
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-09-14

## Goal and scope

SESSION_EXECUTION_AUTHORIZATION: user requested implementation of the remaining
gateway identity gap and investigation/execution of remaining acceptance work
(2026-09-14). Continue authorized local deployment and protected publication.
Owner: agent:codex. Workstream: integration; canonical ticket worktree only.
This slice binds gateway/UI bytes to a pinned local release manifest, fixes
readiness event identity, makes successive local deployments explicit, and
records scoped F/V evidence and remaining work. Preserve existing data, secrets,
runtime rollback containers and unknown packages. No remote peers, observer
activation, trust-root changes or blanket claim of F-01–F-11 readiness.

## Acceptance criteria

- [ ] AC-01: Health reports source only after manifest pin and gateway/UI byte
  verification; missing, malformed or changed identity remains explicit UNKNOWN.
- [ ] AC-02: Streamed observations distinguish expected and observed source.
- [ ] AC-03: Deployment selects exact predecessor containers, pins manifest and
  preserves rollback; synthetic negative tests cover identity and selection.
- [ ] AC-04: Scoped regression, managed gate and independent exact-head CI pass.
- [ ] AC-05: Publish through Validator, verify local deployment, record remaining
  acceptance gaps with evidence and owners, and preserve terminal receipts.

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
