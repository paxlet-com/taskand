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
- [x] AC-02: Native registry discovers and invokes admitted MCP package URI; real stdio/HTTP and invalid-input regressions pass.
- [x] AC-03: Verify local deployments, document unavailable servers and credential prerequisites, preserve unknown outcomes and existing services.

Canonical result: docs/information/mcp-uri-catalog.md.

Local validation: 45 servers / 422 tool packages, all discovered and registered. Seven explicitly admitted native gateway canaries passed; tillm health reports optional client dependencies unavailable. Existing adapter and controller tests pass. Full make test and managed governance pass. Published baseline documents have pre-existing docs findings, tracked separately from the new document. Protected publication remains separate from local delivery.

Resolved validation follow-up: full inventory initially exposed truncated doctor/prescribe and doctor/heal JSON (28/30 contracts). Allocated ticket-031 fixed pipe output and added a regression; final acceptance below supersedes that failed run.

Final continuation 2026-09-19: user prioritized MCP after stopping dashboard. Exact dashboard CLI was stopped and observed gone; lease cancelled by CAS. Clean dashboard checkout privately archived and released, preserving pushed branch/PR38 and running 8082. Restored source committed as 9384699. Ticket031 doctor pipe-output correction committed as 8fa9d47 and fast-forwarded into this branch. Full make test passes with 422 candidates; all 14 doctor regressions pass. Local immutable release on 8084 uses commit 8fa9d47 and preserves request ledger. No push, new PR or merge of this integration. Shared-path integration with PR38 remains a separate protected publication step.


## Profile recovery continuation (2026-09-24)

SESSION_EXECUTION_AUTHORIZATION: user requested continuation after shell deployment and the reported MCP Git/Tillm PROFILE_CHANGED failures. Resume this matching ticket in a separate canonical checkout; ticket-049 remains in publication, unchanged. All historical ticket-030 writer leases are explicitly cancelled. Preserve the old ticket/030-local-mcp-uri-catalog branch.

Repair only existing admitted Git status and Tillm health bindings after the recorded runtime relocation. Generate new immutable versions from fresh equal tool contracts and the current private profiles, test candidates, then replace their grants on gateway 8084. No additional tools or privileges; never relax profile or schema validation.

Recovery result: Git status and Tillm health v2 passed isolated and real gateway 8084 calls. Old v1 packages are preserved and deprecated; only their existing grants moved to v2. All other process records and shell grants remain unchanged. Git now references the canonical Taskand repository instead of a non-Git runtime archive. The private profile snapshot and rollback receipts are outside Git. Tillm health still reports its pre-existing optional package availability separately.

Validation: 13 MCP catalog tests and the native registry regression pass; gateway Git/Tillm v2 calls and the shell export/run regression pass. Full make test stops at a pre-existing conformance failure: missing subactor/ticket-lifecycle/v1 and twin/account/v1 genome entries. The unchanged main checkout reproduces the same failure; it is outside this recovery slice.

The separate contract target also exposes pre-existing missing shell contract fixtures (32/34 pass: shell-build receives an empty request; shell-run lacks its test interpreter). Record this follow-up with the originating shell integration rather than changing unrelated contract ownership in the profile recovery.
