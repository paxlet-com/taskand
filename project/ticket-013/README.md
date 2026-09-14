# Ticket 013: Authenticated local runtime canary

- **ID**: ticket-013
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-09-14

## Goal and scope

SESSION_EXECUTION_AUTHORIZATION: user requested continuation after the merged
runtime-identity repair (2026-09-14). Add a read-only, secret-safe canary for
the local Taskand gateway. It verifies protected context, mesh and registry
read paths without activating observers, changing peers, calling chat/LLM, or
granting deployment authority. The canary is an observation only; it does not
replace OneDev, Validator, readiness, or authenticated human approval.

The token is supplied only through a runtime environment variable and is never
printed, persisted, placed in a URL, or returned in the report. The report
contains bounded statuses, schema checks and counts only.

## Acceptance criteria

- [x] AC-01: Scope is authorized by the continuation request and remains
  limited to read-only local canary observation.
- [x] AC-02: CLI probes federation/catalog, authenticated context, mesh and
  registry-list endpoints with one shared deadline and no redirects.
- [x] AC-03: Missing, invalid or expired credentials fail closed without
  leaking response bodies or token material.
- [x] AC-04: Tests cover success, 401/403, malformed JSON, oversized body,
  timeout and forbidden write/observer actions.
- [ ] AC-05: Governance, full relevant tests and protected exact-head review
  pass; implementation remains outside the ticket directory.

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
