# Ticket 040: Update repository slug references after transfer to paxlet-com/taskand

- **ID**: ticket-040
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-09-21

## Goal and scope

The GitHub repository was transferred from `semcod/taskand-glm53` to
`paxlet-com/taskand` and the local primary checkout moved to
the registered primary checkout of `paxlet-com/taskand`. Update tracked functional references so
protected delivery bindings, the docs adoption pin and the repository README
resolve the new slug and checkout path. Historical documents under `docs/` and
closed `project/ticket-*` records keep their original references as evidence.

SESSION_EXECUTION_AUTHORIZATION: the user's request to transfer the repository
and continue the migration authorizes this ticket's EDIT work.

## Acceptance criteria

- [ ] AC-01: `.governance/required-checks.json` and `.governance/docs.json` bind `paxlet-com/taskand`.
- [ ] AC-02: README and generated project artifacts reference the new slug/path.
- [ ] AC-03: `project/governance-check.sh` passes.

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
