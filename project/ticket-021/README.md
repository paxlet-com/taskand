# Ticket 021: Declare runtime auth and environment contract

- **ID**: ticket-021
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-09-15

## Goal and scope

Make the authenticated developer runtime reproducible in the container
boundary. Pass the existing `TASKAND_AUTH_TOKEN` and the non-secret runtime
controls through Compose so gateway authentication and registry child processes
receive the same configuration as the host. The private `.env` and its example
are handled by a separate governance ticket.

## Acceptance criteria

- [ ] AC-01: Compose passes the auth token and declared runtime controls to the
  gateway without exposing internal child-process variables.
- [ ] AC-02: Environment-contract wiring, governance validation, and relevant
  tests pass; no secret value is tracked.

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
