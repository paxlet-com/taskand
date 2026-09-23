# Ticket 047: Paxlet and nl-dsl-sh local Taskand workflow

- **ID**: ticket-047
- **Owner**: codex
- **Status**: IN_PROGRESS
- **Workflow state**: PUBLICATION
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

14 real-library tests passed with Python 3.13; governance gate: 0 errors, 0 warnings.
Local dependencies installed from the user-specified sibling checkouts.
No live LLM provider request or remote publication was performed.

## Continuation 2026-09-23

SESSION_EXECUTION_AUTHORIZATION: user said “kontynuuj” after the remaining CLI, gateway/MCP, installation, E2E and publication work was listed. Finish this application slice with a JSON process boundary and installer, then protected publication. Shared interfaces belong to a dependent integration ticket. PR #43 was independently observed merged and its terminal receipt was verified by the managed resolver.

JSON process API and explicit local-source installer are now covered by AC-01–03. The process boundary limits inputs to workspace IDs, separates execution and planning, and rejects client-selected credential paths.
