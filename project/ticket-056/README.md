# Ticket 056: Restore shell builtin integrity after catalog dispatch

- **ID**: ticket-056
- **Owner**: agent:codex
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-09-24

## Authorization and evidence

SESSION_EXECUTION_AUTHORIZATION: the user requested continued testing and protected merging. Taskand PR #55 changed `app/shell_workflow.py` but the two active generated shell process adapters still pin its previous SHA-256. The cross-repository local suite fails 24/25 at shell export with `SHELL_ADAPTER_INTEGRITY_MISMATCH`; the failure remains recorded in `~/.local/state/paxlet-tests/cluster-rejoin-009/local.log`.

## Acceptance criteria

- [x] AC-01: Both shell builtins pin the exact merged adapter SHA-256 and the registry package hashes match their on-disk packages.
- [ ] AC-02: A real shell CLI export succeeds, the local end-to-end suite passes, and managed governance and independent exact-head review complete.

The registry verifier reports 38 checked, none broken. The cross-repository
local suite passes 25/25 against this worktree, including the CLI export case
that failed on Taskand main. Managed dirty-tree governance passes with zero
findings. Independent exact-head delivery remains before AC-02 closes.

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
