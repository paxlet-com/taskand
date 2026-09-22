# Ticket 043: Fix browser CDP interaction, NL intent dispatch and integrate twin and subactor connectors

- **ID**: ticket-043
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-09-22

## Goal and scope

1. Enable deterministic Natural Language (NL) browser interaction and scenario execution in `taskand` aligned with `wellmanifest/nl-dsl-llm` and `wellmanifest/nl-api-llm` standards, reusing algorithms from `urirun-connector-browser-control`.
2. Fix CDP session handling in `generated/browser/session/taskand.dev/v1/bin.mjs` (URL encoding, gateway routing, and DOM action commands: click, fill, eval, screenshot).
3. Update `generated/dev/chat/taskand.dev/v1/intent.mjs` and `dispatch.mjs` to route browser operational intents directly to browser session actions without swallowing them into `spawn-web`.
4. Integrate Subactor digital twin (`proc://taskand.dev/twin/account/v1`) and ticket lifecycle (`proc://taskand.dev/subactor/ticket-lifecycle/v1`) capabilities as native generated URI processes with Layer 1 fast-path natural language matching.

## Acceptance criteria

- [x] AC-01: Session execution authorization confirmed per user prompt (`sam wykonaj, przpeorwadz testy scenariuszy za pomocą rozwiązania taskand z uzyciem NL...`).
- [x] AC-02: `browser/session/v1` supports DOM interactions (`click`, `fill`, `eval`, `screenshot`, `navigate`) using CDP and handles `localhost` -> host gateway mapping for containerized browser instances.
- [x] AC-03: `dev/chat` parses browser interaction intents via fast-path matcher (Layer 1 of `wellmanifest/nl-dsl-llm`) and dispatches to `browser/session/v1`.
- [x] AC-04: `proc://taskand.dev/twin/account/v1` and `proc://taskand.dev/subactor/ticket-lifecycle/v1` implement bounded validation and fail-closed defaults.
- [x] AC-05: Test suite (`cli_routing.test.mjs`, `connectors_twin_lifecycle.test.mjs`) passes and `./project/governance-check.sh` passes with zero errors.

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
