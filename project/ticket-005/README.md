# Ticket 005: CDP reliability and operational performance baseline

- **ID**: ticket-005
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-09-14

## Goal and scope

Repair the declared Chromium CDP transport used by the Taskand gateway and
make the browser container report readiness only when its forwarded endpoint is
reachable. Measure the unchanged CLI, gateway and health paths before and after
the deployment. No authentication, observer collection, browser profile data,
or production host is changed.

## Acceptance criteria

- [x] AC-01: Chromium is explicitly configured to expose the forwarded CDP
  endpoint and the container healthcheck tests that endpoint.
- [x] AC-02: Existing Taskand tests pass and the operational benchmark records
  status, hardware, chat and planner timings with no stale test writers.
- [x] AC-03: The running local service is restarted from the exact worktree
  configuration and CDP/health evidence is recorded; rollback is the prior
  Compose configuration.

## Evidence summary

- `GET http://127.0.0.1:9222/json/version`: HTTP 200 after a clean
  `vm-browser` recreation; the forwarded endpoint reports Chromium 152.
- `taskand status --json`: `healthy: true`; the previous
  `BROWSER_CDP_UNAVAILABLE` finding is gone (only informational vault setup
  remains).
- `make test`: 4/4 conformance, 30/30 contracts, 17/17 negative tests and
  8/8 digital/web twin tests passed in 1m19s.
- Warm operational samples: status 2.46–2.88s, twin 0.48–0.60s, hardware
  0.78–0.96s, authenticated chat 0.67–0.79s. These are a reliability gain;
  they are not claimed as a latency improvement without a controlled repeat
  against the same warm-up state.

## Tracking boundary

This directory contains the bounded intent. Raw command output stays in the
external audit directory; it is not delivery output.

Public planfile tracking: GitHub Issue
[#6](https://github.com/semcod/taskand-glm53/issues/6). The issue is an
observation and queue record, not merge approval; the pull request remains
blocked until ticket-004's manifest change is integrated or explicitly
serialized.
