# Ticket 048: Taskand shell CLI and URI integration

- **ID**: ticket-048
- **Owner**: codex
- **Status**: IN_PROGRESS
- **Workflow state**: PUBLICATION
- **Created**: 2026-09-23

## Goal and scope

SESSION_EXECUTION_AUTHORIZATION: user requested continuation of CLI, gateway/MCP, installation, E2E and publication. Depends on ticket-047 (PR #46; protected merge blocked by deployed Validator profile). Continue this disjoint integration slice without changing its head or active tickets 030–032.

## Acceptance criteria

- [x] AC-01: taskand shell routes preparation and explicit execution through native URI registry.
- [x] AC-02: gateway/MCP reuse existing grants and audit, and preparation grant cannot invoke execution.
- [x] AC-03: integration tests and governance pass; installation and deployment instructions are reproducible.

## Validation and delivery

11 CLI/integration tests passed, no skips, including a real gateway, MCP stdio client/server, NL catalog reuse, Paxlet execution receipt and preparation-only denial. Local source installer was executed successfully. No live paid LLM call or production service restart. Dependent publication awaits PR #46 and the protected Validator profile for paxlet-com/taskand.
