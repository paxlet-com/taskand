# Ticket 009: Reproducible local gateway and UI deployment recovery

- **ID**: ticket-009
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-09-14

## Goal and scope

SESSION_EXECUTION_AUTHORIZATION (2026-09-14): user said "naprawiaj" after
the acceptance report identified stale local UI/gateway and missing APIs.
Owner: agent:codex. Implement a reproducible local deployment adapter,
validate a disposable candidate using synthetic credentials, retain the old
runtime for rollback, then replace only glm53-gateway-1 and glm53-landing-1.
Preserve evolved packages and data. Reuse existing secret mount references
without reading contents. No auth policy changes, remote deployment or
observer activation. Canonical worktree: ticket-009--local-runtime-recovery.

## Acceptance criteria

- [x] AC-01: Stage exact merged source outside checkout with content hashes. The
  recovery stage is the external `runtime-recovery-009/stage` audit snapshot,
  bound to `68da36bf97e668695590cd575bb80bd732704d47`, with 164 files and
  manifest digest `4c12b57a5a43b80e77033a463c353ae202c3364f3cae86f7797f405c1045825e`.
- [x] AC-02: Isolated auth, browser and integration checks pass. The disposable
  canary used synthetic credentials; the integration suite passed `43/43` and
  the local adapter suite passed `5/5`.
- [x] AC-03: Retain previous containers and data; exercise recovery. The
  previous runtime remains under the original container names (stopped), and a
  rollback exercise served the retained panel hash
  `717a03f705b98fee327c03226a959a582c8879e20942a2d487eaad49479e7e7b` before
  restoring the candidate. The pre-recovery snapshot is retained at
  an external `taskand-glm53-runtime-20260913` backup snapshot.
- [x] AC-04: Served HTML matches source; context/mesh no longer return 404. The
  active panel hash is
  `958872c1ba15db4d4f3e63d51ebfacb10c782c3274affc8798dd4d5487499753`;
  unauthenticated context returns `401`, while authenticated context and mesh
  return `200`.
- [x] AC-05: Managed gate and bounded deployment/continuity receipts. The
  adapter integrity check and ticket-scoped tests passed; publication remains
  subject to the repository governance gate and independent protected validator.

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
