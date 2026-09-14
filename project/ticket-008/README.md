# Ticket 008: Portable pinned lease backend for isolated verification

- **ID**: ticket-008
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: PUBLICATION
- **Created**: 2026-09-14

## Goal and scope

SESSION_EXECUTION_AUTHORIZATION: the user requested continued Taskand recovery
and faster, standards-respecting operational automation. This disjoint slice
removes the developer-home dependency identified by OneDev issue #304. The
existing ticket-007 delivery controller and ticket-006 panel remain untouched.

Adopt the exact already-used Autonom change-lease module into a pinned local
vendor path. Autonom retains ownership; do not fork its lease semantics. Keep
the independently adopted Wellmanifest transition policy and external store.
No dependency download, CI policy change, secret access or service deployment.

Budget correction before publication: the user's explicit authorization permits
dynamic budgets when they improve delivery without conflicts. GOV-BUDGET-001
observed six implementation paths because the canonical document and index also
count. Correct the declared file limit from four to six, within class M's nine;
the already accepted allowedPaths, three components, zero dependency changes and
zero public interface changes are unchanged. Rebind the lease to the revised
intent instead of retaining an obsolete plan hash. No PR is enlarged.

## Acceptance criteria

- [x] AC-01: The existing real lease test passes without a developer home,
  network or installed Autonom package.
- [x] AC-02: Missing, modified and symlinked backend/policy files fail before
  executing them; loading uses the same bytes whose digest was checked.
- [x] AC-03: Existing lease transitions, CAS fencing and authority boundaries
  remain unchanged; focused regressions and managed governance pass.
- [ ] AC-04: Publish the bounded source through independent exact-head review;
  missing browser confinement or OneDev deployment stays a separate prerequisite.

Canonical result: [portable lease runtime](../../docs/information/portable-lease-runtime.md).
Local evidence: 10 regression tests and 31 existing context tests passed in a
clean-HOME networkless container; managed governance and focused Ruff pass.

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
