# Ticket 057: Opt-in native catalog gateway surface and peer replication

- **ID**: ticket-057
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-09-24

SESSION_EXECUTION_AUTHORIZATION: the user requested continuation of the recorded
delivery queue ("kontynuuj"); ticket-052 explicitly queued binding the native
catalog to gateway and authenticated peer transport as the next governed slice.

## Goal and scope

`app/paxlet_catalog.py` (ticket-052) is a library/CLI component; no gateway
surface or peer transport consumes it. This slice binds it, opt-in only:

- `TASKAND_CATALOG_ROOT` enables the catalog in the gateway process.
- `GET /api/catalog` returns node identity and records (read grant).
- `GET /api/catalog/snapshot` returns the signed schema snapshot (read grant).
- `GET /api/catalog/package?digest=sha256:...` serves the immutable store
  archive (read grant, bounded size).
- `POST /api/catalog/snapshot` applies a pushed snapshot under an admin grant
  with an explicit origin assertion, like the `apply` CLI.
- `TASKAND_CATALOG_PEERS` (JSON `{"peer-origin": "node-id"}`) lets gossip pull
  that peer's snapshot, fetch only missing digest-pinned archives, and apply it
  through `apply_snapshot`. Failures are recorded per peer and never break the
  registry round.

Without both variables nothing is served or pulled. The legacy proc:// registry
and package carrier are unchanged; resolution never executes packages.

## Acceptance criteria

- [x] AC-01: Catalog endpoints require grants and are inert (503
  CATALOG_NOT_CONFIGURED) without `TASKAND_CATALOG_ROOT`.
- [x] AC-02: Pushed snapshots apply only through `apply_snapshot` with an
  explicit origin; stale, conflicting or byte-missing snapshots fail closed.
- [x] AC-03: Gossip applies a mapped peer's snapshot and fetches only missing
  digest-pinned archives; unmapped peers are untouched.

## Validation

`tests/catalog_gateway_test.py` (handler grants, disabled mode, real
snapshot/apply and archive fetch between two disposable catalogs) plus the
existing `gossip_test.py` suite and `./project/governance-check.sh --base
origin/main --head HEAD`.

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
