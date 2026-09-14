# Ticket 003: Stan funkcjonalny Taskand i plan przywrocenia czatu oraz wdrozenia

- **ID**: ticket-003
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: VALIDATION
- **Created**: 2026-09-14

## Goal and scope

User request, 2026-09-14: explain the recent functional work, diagnose the
8090 chat's HTTP 401, and create a step-by-step plan in docs. Session execution
authorization covers read-only checks and this documentation deliverable only;
it does not authorize deployment, enabling observers or changing auth policy.

Participants: user (session request); agent:codex (analysis and documentation).
Managed allocation: project/new-ticket.sh, ticket-003. This documentation-only
slice uses ticket/003-functional-recovery-plan in the sole primary checkout;
no additional worktree or application writer is created. Existing ticket-001
and ticket-002 scopes, history and runtime remain unchanged.

Deliverable: [functional recovery plan](../../docs/refactoring/functional-recovery-plan.md).
Observed source base for the current plan: cf8c606f46edc17332e66c1f39cc6f14b7ff41b7
(`origin/main`, after the protected merges for PRs #8, #9 and #10).
Risks: confusing merged code with deployed code, or past fixtures with current
production evidence. The plan must label those boundaries explicitly.

Continuation requested 2026-09-14: add a post-deployment agent questionnaire
and a subsequent plan for performance, continuous updates, offline fleet
synchronization, reusable packaging, project CI/CD, historical intent and
priority scheduling. The two new docs stay in this existing documentation
ticket; implementation in diagnostic ticket-004's separate worktree is not
modified. This request authorizes documentation here, not its future runtime
effects. Performance standard corrections remain in that repository's own
contract and validator tickets, not in Taskand's implementation scope.

- [Validation questionnaire](../../docs/information/post-deployment-validation-questions.md).
- [Continuous evolution plan](../../docs/refactoring/continuous-evolution-plan.md).

## Acceptance criteria

- [x] AC-01: Explain the observed 401 using the served HTML and gateway contract.
- [x] AC-02: Distinguish merged, tested, deployed and missing capabilities.
- [x] AC-03: Give ordered, bounded steps with prerequisites, acceptance and safety checks.
- [x] AC-04: Validate document metadata, local references and diff; report governance separately.
- [x] AC-05: Every validation question requires scope-bound evidence or an explicit gap.
- [x] AC-06: The next plan separates existing capability, proposed architecture and staged acceptance.

## Validation evidence (2026-09-14)

- Three document front matters parse as `wellmanifest.docs/document/v1`; all
  relative links resolve and every untracked path is inside `intent.json`'s
  allowlist. Whitespace checks pass.
- The deterministic governance checker passes with zero errors and warnings.
- `origin/main` is `cf8c606f46edc17332e66c1f39cc6f14b7ff41b7`; no open PR or
  remote `ticket/*` branch was observed during this validation. The three
  documents and this ticket carrier are still local until the PR is merged.
- Read-only runtime observations: 8090 serves the legacy HTML without a Bearer
  input; unauthenticated `POST /api/chat` returns 401; `/api/context` and
  `/api/mesh/state` return 404; gateway `/healthz` returns 200. No token,
  deployment, observer activation or production effect was attempted.

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
