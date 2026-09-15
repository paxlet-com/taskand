# Ticket 022: Document auth token and runtime environment contract

- **ID**: ticket-022
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-09-15

## Goal and scope

Document the complete operator-facing `.env` contract. Declare the missing
`TASKAND_AUTH_TOKEN` variable and the gateway/browser/vault/model defaults in
the tracked example, and explain how loopback fallback grants differ from a
custom token. The private `.env` remains local and is never committed.

## Acceptance criteria

- [ ] AC-01: `.env.example` declares auth, model, browser, vault, node, path,
  and CLI variables without embedding a private secret.
- [ ] AC-02: README distinguishes `TASKAND_AUTH_TOKEN` (panel/CLI auth) from
  `TASKAND_LLM_API_KEY` (provider credential) and documents loopback safety.
- [ ] AC-03: Existing private `.env` has the local auth variable while its
  private values remain unchanged.
- [ ] AC-04: Governance validation passes and no secret assignment is tracked.

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
