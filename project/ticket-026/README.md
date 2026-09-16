# Ticket 026: Live monag telemetry and hardware capsule packaging

- **ID**: ticket-026
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-09-16

## Goal and scope

Expose live monag telemetry, resume analysis, and desktop/web notifications through gateway router endpoints and the web panel, and establish the standard organism packaging capsule for `hw/monitor/v1` with Dockerfile, test.mjs, package.json and README documentation.

## Acceptance criteria

- [x] AC-01: Expose `/api/monag/status`, `/api/monag/resume`, and `/api/notify` on the gateway router.
- [x] AC-02: Provide web interface and desktop notification options in `index.html`.
- [x] AC-03: Package `generated/hw/monitor/taskand.dev/v1` as a standalone capsule with passing `test.mjs`.
- [x] AC-04: Document the capsule specification in `STANDARD-v2.2.md` section 11.
- [x] AC-05: Pass all governance checks, integration tests, and unit tests.

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
