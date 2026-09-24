# Ticket 049: Taskand shell runtime

- **ID**: ticket-049
- **Owner**: agent:codex
- **Status**: IN_PROGRESS
- **Workflow state**: PUBLICATION
- **Created**: 2026-09-23

## Goal and scope

SESSION_EXECUTION_AUTHORIZATION: user requested Paxlet/nl-dsl-sh integration and continued delivery. Stage merged ticket-048 outside mutable checkouts, verify the configured provider, and prepare reversible deployment. User selected the MCP gateway on port 8084; switching that service is authorized.

## Acceptance criteria

- [x] AC-01: Exact-source runtime staging with pinned local dependencies and isolated canary state.
- [x] AC-02: Real gateway preparation/verification/execution succeeds; live provider result recorded without secrets.
- [x] AC-03: Selected target deployment preserves prior catalog/configuration, verifies health and shell workflow, and records rollback; publication through repository delivery route.

## Validation and remaining deployment

Seven staging, composition and state handoff tests pass; managed governance passes. A separate gateway canary verified export, digest verification, explicit Paxlet execution and anonymous denial. One live GLM-5.3 request produced a valid plan and compiled successfully without execution. External receipts bind the staged source to ticket-048 merge commit 82e192c14881b2138dfd34c8ab1b543c57ba08e1.

Deployment target confirmed: MCP gateway on port 8084. The 8084 catalog has nine active imported MCP processes absent from the candidate; two shared process hashes also differ. Preserve these bindings before switching. The selected gateway is deployed with the shell adapter from the merged source, preserving all 457 previous catalog entries and adding two shell URIs.


## Deployed result

The 8084 gateway uses a composed runtime: original gateway commit
3444d0d03ef2232eae0ca7cd82c06a2812724263 plus shell source
82e192c14881b2138dfd34c8ab1b543c57ba08e1. The existing mcp-local credential and
prior grants remain; precisely shell-build and shell-run were added. Provider
configuration is outside Git with mode 0600. A real HTTP probe verified export,
digest verification, explicit execution and live model planning/compilation.

The same context directory was transferred by atomic rename with device/inode
checks during restart. A separate transient-unit canary verified forward transfer
and rollback. The first deployment attempt automatically restored the old gateway
when symlink-based state attachment was rejected; a second stop/start attempt
required restoring the transient unit. The final method preserves that unit through
restart and uses a guarded ExecStartPre state transfer. Rollback command, original
unit bindings, data identity and deployment receipts are stored externally.

Known pre-existing issue: imported MCP Git and Tillm return PROFILE_CHANGED before
and after deployment. Their configuration and complete catalog entries were
preserved. Follow-up requires the MCP profile owner to reconcile the protected
profile digest; do not waive the binding check. Publication remains PR #48 until
an independent merge is observed.
