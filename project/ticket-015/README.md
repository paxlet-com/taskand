# Ticket 015: Resolve the installed Chrome binary in the mesh browser pilot

- **ID**: ticket-015
- **Owner**: agent:codex
- **Status**: IN_PROGRESS
- **Workflow state**: PUBLICATION
- **Created**: 2026-09-14

## Goal and scope

SESSION_EXECUTION_AUTHORIZATION: user requested repair and continued publication
on 2026-09-14. Repair browser executable discovery in the isolated mesh pilot;
preserve its sandbox, authentication assertions and required CI coverage.
No shared executor changes, production effects or modification of ticket-011.

## Acceptance criteria

- [ ] AC-01: The pilot resolves the installed canonical Chrome binary when the
  distribution launcher is absent; missing dependencies fail explicitly in CI.
- [ ] AC-02: Discovery regressions and the real isolated browser pilot pass
  without disabling Chromium sandboxing or omitting assertions.
- [ ] AC-03: Managed governance and protected exact-head verification pass;
  publish through the independent Validator, never direct merge.

## Tracking boundary

The user explicitly authorized controller release of the ticket-011 lease and
disjoint repair in ticket-015 on 2026-09-14. Ticket-011 code and PR remain intact.
Coordination request: https://github.com/semcod/taskand-glm53/pull/14#issuecomment-5667184554
The inspected OneDev receipt 6ebe92612106a3ce393b65ce binds PR14 head
2d1295c2a7d6b0d4b6c4784f0f72f01c1ec2df4c and base
c9fa3f47cb087122c49e70be97030ced9d88ef34. All Node suites passed;
Python ran 102 tests with one skip. Read-only executor inspection confirmed
Playwright and /opt/google/chrome/chrome, but no /usr/bin/google-chrome.
The controller accepted the authorized release and admitted ticket-015 with
a separate lease. Local validation: 92 Python tests passed without skips,
including the real sandboxed browser and seven new discovery/failure regressions;
managed governance, Ruff and Compose configuration validation passed. No sandbox
flag, product runtime, required check or PR14 source was changed.
Independent exact-head publication remains pending.

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
