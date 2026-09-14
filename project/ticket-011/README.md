# Ticket 011: Fail-closed local snapshot and restore adapter

- **ID**: ticket-011
- **Owner**: agent:codex
- **Status**: IN_PROGRESS
- **Workflow state**: PUBLICATION
- **Created**: 2026-09-14

## Goal and scope

SESSION_EXECUTION_AUTHORIZATION: user requested continued recovery implementation
(2026-09-14). Owner agent:codex; integration workstream. Implement a bounded
operator adapter for stopped-container context snapshots and verified restore
into a new private directory. Tests use synthetic data only. No production
snapshot, data overwrite, service restart, shared CI configuration or secret
inspection is authorized by this slice. Publication uses the protected process.

## Acceptance criteria

- [ ] AC-01: Snapshot requires exact stopped container identity and explicit
  sensitive-data acknowledgement; failed, oversized or unsafe copies publish nothing.
- [ ] AC-02: Restore verifies the expected digest and SQLite integrity before
  creating a fresh private context directory; existing data is never overwritten.
- [ ] AC-03: Synthetic round-trip and negative tests, managed gate and protected
  exact-head checks pass; no automatic start/switch or false recovery receipt.

## Tracking boundary

Local evidence: 17 snapshot/restore regressions plus 8 existing deployment tests
pass, including descendant cleanup after parent exit. Real Docker export and
restore of a synthetic Store passed with the original profile URN preserved.
The required OneDev discovery now includes tests/context_snapshot_test.py; the
target-owned manifest records its integration ownership. No shared CI policy
or required check was relaxed. Independent publication remains pending.

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
