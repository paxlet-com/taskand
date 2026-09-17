# Ticket 027: Track Planfile GitHub sync workflow

- **ID**: ticket-027
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-09-17

## Goal and scope

Commit `.github/workflows/planfile-github-sync.yml`: it sat untracked in
the primary checkout, which is dirty-primary debris and (per the same
pattern already tracked in `semcod/monag#26`) the source of drift between
what's on disk and what's reviewed. The workflow itself (hourly + on-push
to `.planfile/**`, calling `semcod/planfile`'s reusable sync job) was
already active and running before this ticket -- committing it makes the
already-running behavior reviewable instead of invisible.

No behavior change: the workflow content is committed exactly as found.

## Acceptance criteria

- [x] AC-01: `.github/workflows/planfile-github-sync.yml` is tracked,
      committed exactly as it was already running, no edits.
- [x] AC-02: Primary checkout is clean of this file afterward.

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
