# Ticket 059: Fix github-projects-discovery timeout

- **ID**: ticket-059
- **Owner**: antigravity
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-09-26

## Goal and scope

Optimize `proc://taskand.dev/admin/github-projects-discovery/v2` commit discovery and filesystem traversal:
1. Use fast file-based commit log reading (`.git/logs/HEAD`) to avoid synchronous `git log -1` process spawns across hundreds of repositories.
2. In `scan()`, prune recursion upon identifying a repository root boundary.
3. Ensure 100% of all contract tests (`tests/contract_tests.mjs`, 34/34), conformance (`tests/conformance.mjs`, 4/4), and negative tests (`tests/negative_tests.mjs`, 17/17) pass.

## Acceptance criteria

- [x] AC-01: `proc://taskand.dev/admin/github-projects-discovery/v2` finishes in under 15 seconds across hundreds of repositories and passes `tests/contract_tests.mjs`.
- [x] AC-02: Binding hash integrity check `taskand verify` passes for all packages.
- [x] AC-03: `tests/conformance.mjs` passes 4/4 and `tests/negative_tests.mjs` passes 17/17.
- [x] AC-04: `./project/governance-check.sh` passes with 0 errors and 0 warnings.

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
