# Ticket 018: Developer panel token bootstrap via loopback URL

- **ID**: ticket-018
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-09-15

## Goal and scope

Provide an opt-in developer-only bootstrap for the Web Cockpit at `localhost:8090`.
The bootstrap accepts a token only on loopback when the explicit
`taskand_dev=1` flag is present, loads it into the existing in-memory field,
and immediately removes both query parameters from the visible URL. The
gateway contract remains unchanged: API calls still use `Authorization:
Bearer`, and production or non-loopback pages never accept the bootstrap.

## Acceptance criteria

- [x] AC-01: User explicitly requested the developer URL bootstrap.
- [ ] AC-02: Valid loopback bootstrap is consumed once and scrubbed from URL/history.
- [ ] AC-03: Non-loopback or missing developer flag never populates the token field.
- [ ] AC-04: Existing manual-token, logout, 401/403 and no-storage behavior remains intact.
- [ ] AC-05: UI regression and governance checks pass.

## Non-goals

- No token is placed in API request URLs, localStorage, sessionStorage, HTML,
  or the gateway logs by this feature.
- No change to `grants.yaml`, token generation, gateway authentication, or
  production deployment defaults.

## Tracking boundary

This directory contains the minimal reviewed contract. Optional participant
prose and raw command logs are not delivery output.
