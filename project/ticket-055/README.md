# Ticket 055: Execute approved native Paxlet actions through Taskand shell

- **ID**: ticket-055
- **Owner**: agent:codex
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Session bound**: maxActiveMinutes=120; checkpointMinutes=30

## Authorization and scope

SESSION_EXECUTION_AUTHORIZATION: the user requested continued testing and protected
merging of the Paxlet/nl-dsl-sh Taskand integration. This application slice binds
the merged native catalog to the local shell process boundary. The read-only
work-start check admitted this disjoint application scope on Taskand main
`f008a27743b20334236d1534715c0fc60a8ba8d4`.

The selected catalog root and execution workspace belong to the operator. A
client supplies only an approved package selector, exact digest, action, bounded
input and a fresh run ID. No gateway/MCP route, peer transport, auto-approval or
production service is changed here. Paxlet PR #2 is the exact tested dependency
candidate until its independent governance gate is repaired and published.

## Acceptance criteria

- [x] AC-01: A locally approved catalog action resolves to verified immutable
  Paxlet bytes and executes only after an explicit digest-pinned request.
- [x] AC-02: The process boundary rejects unapproved, withdrawn, ambiguous,
  tampered and mismatched packages before execution; a run ID cannot overwrite
  an existing execution workspace or receipt.
- [x] AC-03: Existing shell operations remain compatible; run focused and
  managed governance checks, then use independent exact-head protected delivery.

## Tracking boundary

External checkpoints, test receipts and delivery state belong under
`~/.local/state/taskand/catalog-shell-055/`. A protected merge does not deploy the
gateway on port 8084; that remains a separate integration slice after historical
gateway branches are reconciled.

## Validation

With the exact Paxlet PR #2 candidate and local nl-dsl-sh source, all 16 shell
workflow tests and all 23 native catalog tests pass. The new test performs a real
package export, store installation, explicit local approval, fresh materialization,
digest-pinned action call and persisted receipt check. It also verifies that
unapproved, mismatched, withdrawn and reused run IDs do not start a second action.
The changed-path managed governance gate passes with zero findings. Exact-head
governance and hosted checks are completed after the material commit.
