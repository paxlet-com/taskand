# Ticket 049: Taskand shell runtime

- **ID**: ticket-049
- **Owner**: agent:codex
- **Status**: IN_PROGRESS
- **Workflow state**: PUBLICATION
- **Created**: 2026-09-23

## Goal and scope

SESSION_EXECUTION_AUTHORIZATION: user requested Paxlet/nl-dsl-sh integration and continued delivery. Stage merged ticket-048 outside mutable checkouts, verify the configured provider, and prepare reversible deployment. Existing gateways remain pending explicit target selection (8077/8082/8084).

## Acceptance criteria

- [x] AC-01: Exact-source runtime staging with pinned local dependencies and isolated canary state.
- [x] AC-02: Real gateway preparation/verification/execution succeeds; live provider result recorded without secrets.
- [ ] AC-03: Selected target deployment preserves prior catalog/configuration, verifies health and shell workflow, and records rollback; publication through repository delivery route.

## Validation and remaining deployment

Five staging/tamper tests pass; managed governance passes. A separate gateway canary verified export, digest verification, explicit Paxlet execution and anonymous denial. One live GLM-5.3 request produced a valid plan and compiled successfully without execution. External receipts bind the staged source to ticket-048 merge commit 82e192c14881b2138dfd34c8ab1b543c57ba08e1.

Deployment awaits the existing async target choice: 8077, 8082 or 8084. The 8084 catalog has nine active imported MCP processes absent from the candidate; two shared process hashes also differ. Preserve these bindings before switching. Current tooling does not switch any service.
