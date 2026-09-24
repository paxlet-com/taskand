# Ticket 052: Native Paxlet catalog and revisioned snapshots

- **ID**: ticket-052
- **Owner**: agent:codex
- **Status**: IN_PROGRESS
- **Workflow state**: VALIDATION
- **Session bound**: maxActiveMinutes=120; checkpointMinutes=30

## Authorization and scope

SESSION_EXECUTION_AUTHORIZATION: user requested continuation of PLF-003 and
previously authorized deeper development-stage architecture changes. The existing
Taskand ticket-051 is locally complete, clean and explicitly handed off; tests
PR #7 awaits protected infrastructure/review. Preserve both. This disjoint
application slice is admitted by the pinned managed work-start reader in Paxlet
(Taskand adoption predates that reader); allocator reserved ticket-052.
One primary writer owns app/paxlet_catalog.py, its tests and operator documentation.
No production data migration, protected policy change or remote publication.

## Acceptance criteria

- [x] AC-01: Stable persisted node identity and one transactional native catalog;
  package/action records derive only from verified immutable Paxlet content.
- [x] AC-02: Explicit namespace ownership, conflict rejection, local approval and
  alias registration; resolution pins identity, version, action and digest without execution.
- [x] AC-03: Bounded full snapshots with origin/revision/content binding;
  atomic acceptance rejects stale, conflicting, incomplete or unauthorized state.
- [x] AC-04: Persist withdrawals and accepted origin revisions across restarts;
  remote changes cannot copy approval/grants, revive withdrawn versions or expose partial imports.
- [x] AC-05: Provide an operator CLI and reproduction docs; validate independent
  nodes, offline/rejoin, failed import, concurrent updates and source integrity,
  then run the managed gate and record exact delivery state.

## Boundaries

This is the native catalog foundation. Existing gateway, MCP, generated registry,
CLI dispatch and gossip remain on their accepted interfaces until a coordinated
integration slice can switch them. No claim of completed ecosystem cutover.

## Intent schema reconciliation

The adopted Taskand intent validator predates structured component-local-state
records. Keep the new opt-in SQLite layout explicit in the architecture decision;
`dataChanges` is empty because this slice moves no existing persistent data and
transfers no responsibility between existing components. Gateway/registry cutover
and data migration remain separate integration work. Scope and authorization are
unchanged. Rebind the corrected intent through controller CAS, retaining the
original session deadline; do not alter the managed validator or its pin.

## Validation and delivery

- Native catalog: 23/23 host tests and 23/23 in a non-root Docker process with
  no network, read-only mounts/filesystem, bounded temporary storage and resources.
- Existing shell workflow: 14/14 against the same Paxlet development checkout
  and local nl-dsl-sh source. No paid model calls or live gateway changes.
- Dirty changed-path governance: PASS, zero errors/warnings. Exact commit range
  is verified after the material commit and recorded in the external ledger.
- Tested Paxlet: `48e7203410d43a56473e81bdc3783fd09adaddaf`. Docker image:
  `paxlet-ticket-002-interop` (immutable ID recorded externally).
- Three-node evidence uses independent CLI processes/databases/stores and actual
  original archives with durable restart/offline behavior; no LAN/HTTP claim.
- Failure injection covers partial content import and interruption inside the
  withdrawal transaction; entries, local approval and cursor roll back together.
- Scope: three implementation/documentation files, one component, no new runtime
  dependencies. Source and test hashes accompany the local delivery ledger.

External evidence and recovery: `~/.local/state/taskand/paxlet-catalog-052/`.
No push, PR, merge or deployment is authorized by this slice's outcome. Preserve
locally validated ticket-051 and tests PR #7. PLF-003 remains in progress; next
integration must bind gateway/MCP/CLI invocation and authenticated peer transport
to this catalog before replacing the legacy registries and package carrier.

## Publication continuation — 2026-09-24

SESSION_EXECUTION_AUTHORIZATION: the user again requested continuation after the
prior push/merge/test instruction. Publish this completed slice through the
repository's independent protected review. The earlier local handoff was an
explicit cancellation of its lease, not a final decision against publication.
Revalidate on merged Taskand `b816a953a35f8b4a7c39a045a96167f63a24fc79`
and current Paxlet PR #2 candidate. The gateway/MCP/gossip cutover, production
migration and protected policy changes remain outside this slice. Preserve
historical branches and the other owner's Wellmanifest ticket-270.
