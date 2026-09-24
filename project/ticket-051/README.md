# Ticket 051: Bounded authorized gossip and isolated peer tests

- **ID**: ticket-051
- **Owner**: agent:codex
- **Status**: IN_PROGRESS
- **Workflow state**: VALIDATION
- **Created**: 2026-09-24
- **Session bound**: maxActiveMinutes=120; checkpointMinutes=30

## Authorization and scope

SESSION_EXECUTION_AUTHORIZATION: user requested continuation and testing of the
Paxlet/Taskand ecosystem, with development-stage architectural changes allowed.
PLF-003 carries the parent request; Paxlet ticket-002 is committed and preserved.
Continue Taskand ticket-050's merged behavior in a new isolated integration slice.
Observed PR #50 through GitHub and recorded its actual terminal receipt through
the managed ancestry-verifying resolver; no source/history or approval fabricated.
No active Taskand lease or registered writer overlaps this scope.

## Acceptance criteria

- [x] AC-01: Peer credentials are explicitly scoped; no local admin-token fallback,
  redirects, unbounded payloads or automatic trust of discovered endpoints.
- [x] AC-02: Sync trigger/status require corresponding registry grants; imports
  remain candidates unless explicit operator policy opts into approval.
- [x] AC-03: Serialize sync rounds, bound peers/packages/work time, report content
  conflicts and failed imports accurately, handle offline/rejoin and retries.
- [x] AC-04: Federation validates/stages before atomic installation; preserve
  existing packages on failure and reject malformed payload/identity/hash claims.
- [x] AC-05: Test actual HTTP peer exchange and isolated registry instances,
  tampering, redirects, partial failures, concurrent rounds and authorization;
  run Paxlet interoperability, relevant stack checks and full governance.

## Boundaries and next action

Implementation and scoped validation are complete for a local commit. This slice
hardens the existing worker before the common Paxlet catalog cutover; it does not
claim logical revision/tombstone convergence or change live node configuration.
Protected publication is separate from local verification.

## Validation evidence

- Gossip: 23/23 on host and 23/23 in the existing Paxlet interop image with
  read-only mounts, no external network and a non-root user. Both runs include
  three HTTP peers, real registry subprocesses and the Paxlet store round trip
  against Paxlet `48e7203410d43a56473e81bdc3783fd09adaddaf`; no skipped tests.
- Related mesh and shell workflow tests: 34/34, with the current Paxlet checkout
  and local nl-dsl-sh source supplied through PYTHONPATH.
- Disposable registry integration suite: 43/43. Full changed-path governance:
  PASS, zero errors/warnings. `git diff --check`: PASS.
- Full conformance: 3/4 on this change **and** accepted base `41268dd`; both
  lack the existing `subactor/ticket-lifecycle/v1` and `twin/account/v1` entries
  in genome. The content-hash and package-isolation checks pass.
- Generic empty-input contract suite: 32/34 here **and** on accepted base;
  shell-build rejects a missing operation, shell-run reports its absent isolated
  environment. Dedicated shell workflow tests above pass. These baseline findings
  are preserved for a separate admitted slice, not waived or called a full PASS.
- Goal workspace audit preserves eight historical Taskand branches and another
  repository's dirty ticket-007 checkout. No deletion or cleanup authority was
  inferred. Canonical Taskand/Paxlet delivery checkouts have no layout anomalies.

Reports and the bounded recovery chain are external under
`~/.local/state/taskand/paxlet-sync-continuation/`. Final exact-head validation
and delivery state belong to that external ledger, avoiding a closure commit.
The operator contract and remaining architecture work are documented in
[`cluster-sync.md`](../../docs/information/cluster-sync.md).

## Publication continuation (2026-09-24)

SESSION_EXECUTION_AUTHORIZATION: user requested push, merge and testing. Resume
this ticket after its explicit clean handoff. Refresh against merged admission
control `4a2334119919139a73eb52f79a6425e462c8ca9f` and validate the combined
gossip/admission behavior before independent protected review. The tests
repository ticket-007 cluster suite depends on this change. Preserve historical
branches; they grant no write or discard authority. No live deployment is included.
