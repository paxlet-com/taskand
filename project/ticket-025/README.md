# Ticket 025: Ignore ephemeral container interfaces in twin source-change check

- **ID**: ticket-025
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: VALIDATION
- **Created**: 2026-09-15

## Goal and scope

`twin/environment/v1` compares the node topology before and after a scan and
fails with `SOURCE_CHANGED` when it differs. A crash-looping container on the
host added and removed `veth*` interfaces every ~13 s, so a 7–10 s nmap scan
was rejected even though LAN addressing was stable.

The comparison key now ignores ephemeral interfaces (`veth*`, `br-*`,
`docker*`, `cni*`, `flannel*`, `virbr*`) unless their subnet was part of the
scan. Depends on ticket-024 (stacked branch; shared integration ownership list).

## Acceptance criteria

- [x] AC-01: Container interface churn keeps the source key; a LAN address
  change or a change on a scanned bridge subnet still yields `SOURCE_CHANGED`.
- [x] AC-02: `taskand verify`, `make test` and `./project/governance-check.sh` pass.

## Authorization

SESSION_EXECUTION_AUTHORIZATION: split from the requester's "commit all changes"
task because the combined diff exceeded the 15-file delivery limit. Local commit
on the ticket branch only; publication (push/PR) is not part of this authorization.

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
