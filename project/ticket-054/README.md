# Ticket 054: Preserve catalog backpressure during peer pulls

- **ID**: ticket-054
- **Owner**: agent:codex
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-09-24

SESSION_EXECUTION_AUTHORIZATION: continue, merge and test the Taskand/Paxlet
integration. This bounded dependency unblocks tests ticket-007. Two exact-input
cluster runs found catalog HTTP503 converted into REGISTRY_ERROR/HTTP502 during
rejoin. Preserve the explicit overload outcome so a bounded caller can retry.
Allocator reserved054 after fetching main; preserve unrelated ticket052 and all
historical branches. No deployment or discarded work is authorized by this note.

## Acceptance criteria

- [x] AC-01: Catalog HTTP503 yields BUSY/retryable and gateway503 without installing a package.
- [x] AC-02: Redirects, authorization failures and generic upstream errors remain rejected; no credential forwarding or hidden retry.
- [x] AC-03: Real HTTP/registry tests cover overload, recovery and unchanged idempotent package state; run relevant admission and governance checks.

External evidence: ~/.local/state/paxlet-tests/publication-recovery-20260924/taskand54/.
Protected exact-head review and merge remain mandatory.

Validation: 25/25 isolated gossip/registry tests with exact Paxlet candidate aeac2ac;
13/13 admission tests. The new regression fails on merged base b86fa6d with
REGISTRY_ERROR instead of BUSY and passes here. No automatic server retries.
