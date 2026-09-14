# Ticket 006: Panel authorization recovery and bounded requests

- **ID**: ticket-006
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: PUBLICATION
- **Created**: 2026-09-14

## Goal and scope

SESSION_EXECUTION_AUTHORIZATION, 2026-09-14: continue the functional recovery
plan and consider bounded budget changes that speed delivery without conflicts.
This is the authorization/error-handling portion of F-03, not its deployment or
artifact version-binding portion. Agent: codex.

Only index.html and tests/mesh_test.py change. Both are owned by integration and
disjoint from ticket-003 documentation and ticket-004 diagnostics. The user-supplied
AGENTS.md section 2 permits this second disjoint implementation under the manifest's
four-ticket limit. The older allocator rejected the workstream name alone;
--force-new was used under that explicit permission, not to waive path checks.
Allocation reserved ticket-006 under the clone-wide lock after fetch/prune;
the first rejected allocation reserved ticket-005, which is not reused.
The generated directory was moved once into the managed canonical relative worktree.

Keep PR #4 head immutable while OneDev provisioning waits. No shared CI security
policy change, credential access, production deployment or provider invocation.
Use M / 60 minutes, two files, two components, zero dependencies; the class allows
browser regression work without changing runtime or acceptance limits.
Publish through protected OneDev and independent Validator when available.

Current infrastructure observation: the deployed OneDev image lacks Taskand's
published profile and browser sandbox tools. A clean disposable uid-10000,
networkless, cap-drop-ALL container on image e4bd9083b6ba rejects unshare(CLONE_NEWUSER)
with EPERM. Installing a browser alone cannot qualify this executor. Infrastructure
ownership remains subactor/onedev-agent issue #304; no gate is bypassed here.

## Acceptance criteria

- [x] AC-01: Empty token causes a local explanation and no API call; 401, 403,
  network, timeout and server failures are distinct and never echo raw errors.
- [x] AC-02: Logout clears token and private projections, aborts pending reads,
  and prevents stale results from repopulating the panel; storage stays empty.
- [x] AC-03: Real-browser API regression and managed gate pass, with publication
  and remaining F-03/F-04 requirements reported separately.

Local evidence: 50/50 Python tests, no skips, 32.415 seconds in a separate native
source fixture with empty environment and temporary HOME. Real Chromium keeps its
sandbox enabled; browser requests are allowlisted to local synthetic fixtures.
This is not a networkless OneDev receipt. The additional nested-bwrap run fails
Chrome's SUID sandbox prerequisite; no browser sandbox switch was disabled.
Working-tree governance passes without managed-file or scanner exceptions.

The browser regression first observed only the compile option: malformed closing
option tags silently removed plan/chat from the real selector. Their fix and
three-option DOM assertion are part of this auth-recovery slice. The existing
private-field fixture used a secret-like literal; it is now explicitly test-only,
with the same non-projection assertion. No real credential was read or rotated.

Publication and deployment remain unconfirmed until the required exact-head
OneDev receipt and independent Validator merge. F-03 still needs gateway/UI
artifact identity/readiness binding; F-04 still needs a qualified runtime canary
and controlled switch of the old snapshot. Neither is claimed by these tests.

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
