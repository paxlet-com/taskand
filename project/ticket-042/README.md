# Ticket 042: Track local Gitea registry module

- **ID**: ticket-042
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-09-21

## Goal and scope

Commit the previously untracked `infra/gitea/` module: a local Gitea/OneDev
interchangeable Git and OCI/NPM registry for Taskand development. The module
contains `docker-compose.yaml` (rootless Gitea 1.22 on 127.0.0.1:3000/2222),
`sync-registry.sh` (mirror synchronisation) and `README.md` (provider
configuration via `TASKAND_GIT_REGISTRY_PROVIDER`). The `data/` volume mount is
ignored through a nested `infra/gitea/.gitignore` so runtime state is never
committed.

## Acceptance criteria

- [x] AC-01: `infra/gitea/` is tracked under the `infrastructure` workstream.
- [x] AC-02: `infra/gitea/data/` runtime state is ignored by Git.
- [x] AC-03: `./project/governance-check.sh` passes on the ticket branch.

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
