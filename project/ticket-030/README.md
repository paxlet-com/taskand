# Ticket 030: Local MCP URI package catalog

- **ID**: ticket-030
- **Owner**: codex
- **Status**: IN_PROGRESS
- **Workflow state**: PUBLICATION
- **Created**: 2026-09-19

SESSION_EXECUTION_AUTHORIZATION: user requests all local and suitable GitHub MCP servers as URI processes in taskand/glm53/mcp with generated-like structure, and explicitly authorizes handoff from codex-mcp029-20260919. Intake PLF-006.

Prior ticket-029 source, deployed pilot and PR38 remain intact, awaiting its protected executor prerequisite. Its writer reservation was explicitly handed off (CAS revision 3/fence 316 -> cancelled revision 4/fence 317). This separately allocated native package slice respects the existing ticket file budget and does not edit its controller or dashboard. One integration writer; no parallel writes to shared registry/contracts.

## Acceptance

- [x] AC-01: Inventory every local registration; build deterministic, versioned MCP process packages with metadata/schema/source provenance and private host configuration.
- [ ] AC-02: Native registry discovers and invokes admitted MCP package URI; real stdio/HTTP and invalid-input regressions pass.
- [x] AC-03: Verify local deployments, document unavailable servers and credential prerequisites, preserve unknown outcomes and existing services.

Canonical result: docs/information/mcp-uri-catalog.md.

Local validation: 45 servers / 422 tool packages, all discovered and registered. Seven explicitly admitted native gateway canaries passed; tillm health reports optional client dependencies unavailable. Existing adapter and controller tests pass. Full make test and managed governance pass. Published baseline documents have pre-existing docs findings, tracked separately from the new document. Protected publication remains separate from local delivery.

Validation follow-up: full inventory exposes truncated doctor/prescribe and doctor/heal JSON (28/30 contracts). MCP suite passes; local integration commit is not final acceptance. Preserve this ticket and allocate a bounded follow-up for stdout flushing before claiming full completion.
