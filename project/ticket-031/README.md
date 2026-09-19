# Ticket 031: Complete large doctor JSON responses for MCP catalogs

- **ID**: ticket-031
- **Owner**: codex
- **Status**: IN_PROGRESS
- **Workflow state**: VALIDATION
- **Created**: 2026-09-19

SESSION_EXECUTION_AUTHORIZATION: user requests completion of local MCP integration after stopping dashboard. This bounded dependency fixes the reproduced 8 KiB pipe truncation exposed by ticket030's 422 candidates. Ticket030 source is committed as 9384699; no concurrent implementation writer.

- [x] AC-01: Both real doctor CLIs emit full valid JSON, preserve the final record and existing plan-only semantics; full MCP catalog contracts pass.

Canonical integration report: docs/information/mcp-uri-catalog.md, to be updated under ticket030 after this dependency is joined. This ticket owns only doctor output and its regression.

Validation: regression failed before correction and all 14 doctor tests pass after it. Full make test passes with 422 registered MCP candidates: 4 conformance, 30 contracts, 17 negative, 9 twin, 8 web twin, 7 CLI, 11 MCP Python and 1 MCP registry. Managed governance passes.
