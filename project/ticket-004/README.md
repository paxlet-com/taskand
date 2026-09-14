# Ticket 004: Bounded diagnostic latency and adaptive recovery budgets

- **ID**: ticket-004
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: PUBLICATION
- **Created**: 2026-09-14

## Goal and scope

SESSION_EXECUTION_AUTHORIZATION, 2026-09-14: the user requested the next
functional recovery tasks, diagnosis and improvement of obstructive standards,
and consideration of dynamic budgets where delivery improves without conflicts.
This slice implements F-02, reconciles the observed PR #3 terminal state through
the managed activity resolver, and records Taskand-specific readiness evidence.
No production credentials, live observers or production healing are needed.
Protected publication is part of delivery; independent exact-head checks apply.

Agent: codex. Worktree: .worktrees/ticket-004--diagnostic-recovery.
The allocator reserved ticket-004 under the clone-wide lock after remote fetch;
only its freshly generated directory was moved into the canonical worktree.
The user's untracked ticket-003 and recovery plan remain in the primary checkout.

Budget decision: M / nine material files / three components / no dependencies.
Probe parallelism and deadline may adapt within explicit bounds; findings,
authority, scope ownership and the integration test's 20-second acceptance remain.
Target-owned manifest routing is declared before changing doctor source, which
currently has no owning workstream. Managed checker bytes and pins are unchanged.
Report: docs/analysis/diagnostic-recovery.md.

## Acceptance criteria

- [x] AC-01: Deterministic deadline, bounded parallelism and per-check timing;
  unavailable services and invalid registry responses cannot report healthy.
- [x] AC-02: Repeated isolated integration passes within the existing 20 s limit;
  regressions cover timeout, refusal, fallback and malformed responses.
- [x] AC-03: Managed governance and stack checks; evidence distinguishes local
  implementation, publication and deployment, with actionable remaining blockers.

Local delivery evidence: 13/13 diagnostic regressions; three 43/43 integration
runs at 15.5–17.2 s; conformance 4/4 and process contracts 30/30. Working-tree
and exact-base/head governance pass. Protected publication remains pending:
the deployed Validator preflight reports LOCAL_EXECUTOR_MISSING for Taskand.
The separate documentation audit exposed a real adjacent-brace false positive;
its HOME fix is wellmanifest/docs ticket-006, not an adopter bypass.

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
