# Ticket 041: Rebind required-checks to paxlet-com/taskand

- **ID**: ticket-041
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-09-21

## Goal and scope

SESSION_EXECUTION_AUTHORIZATION: the user ordered continued cleanup of the
`semcod/taskand-glm53` -> `paxlet-com/taskand` transfer backlog
("od teraz taskand, ale zajmij sie zaleglosciami").

After the repository transfer, `.governance/required-checks.json` still pins
`semcod/taskand-glm53`. The path is integration-owned
(`coordination.integration.requiredForPaths`), so ticket-040 had to revert it;
this integration-workstream ticket performs the rebind.

## Acceptance criteria

- [x] `.governance/required-checks.json` binds `paxlet-com/taskand`.
- [x] `./project/governance-check.sh` passes.

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
