# Ticket 047: Paxlet and nl-dsl-sh local Taskand workflow

- **ID**: ticket-047
- **Owner**: codex
- **Status**: IN_PROGRESS
- **Workflow state**: VALIDATION
- **Created**: 2026-09-23

## Goal and scope

SESSION_EXECUTION_AUTHORIZATION: user requested using Paxlet and local nl-dsl-sh in Taskand.
Add a local Python application adapter for NL planning, compilation, verified Paxlet export and explicit execution.
Use installed upstream packages, document local source installation. No gateway, registry, shared CLI or remote publication changes.
The integration workstream has four active reservations; this application slice is disjoint.

## Acceptance criteria

- [x] AC-01: Offline catalog alias and JSON plans compile through nl-dsl-sh without executing task code.
- [x] AC-02: Export validates with Paxlet and reports its digest; explicit run checks that digest and returns the Paxlet receipt.
- [x] AC-03: Real package roundtrip and invalid/tampered input tests pass; managed gate result recorded.

## Validation

11 real-library tests passed with Python 3.13; governance gate: 0 errors, 0 warnings.
Local dependencies installed from the user-specified sibling checkouts.
No live LLM provider request or remote publication was performed.
