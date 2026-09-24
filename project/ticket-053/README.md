# Ticket 053: Bound gateway execution admission under overload

- **ID**: ticket-053
- **Owner**: agent:codex
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT

SESSION_EXECUTION_AUTHORIZATION: continue the user's autonomy testing/fix and
publication request. Parent request PLF-003; tests ticket-007-load reproduced
1/8 verified outcomes with EAGAIN/thread failures under eight same-node calls.
Protected merge for tests PR7 remains blocked and preserved. The managed admission
reader admits this disjoint scope; tickets 051 and 052 are clean and explicitly
handed off. No source or protected policy from those tickets is changed.

## Acceptance criteria

- [ ] AC-01: Bound registry process admission before spawn; execution saturation
  leaves separate control/read capacity and returns HTTP 503 BUSY without effects.
- [ ] AC-02: Always release slots on errors/timeouts; classify resource failures
  and unknown failed outcomes without falsely reporting HTTP 200 success.
- [ ] AC-03: Deterministic concurrency regressions, isolated real-process overload
  probe and governance pass; retain exact source/input/result and cleanup evidence.

## Continuation

The earlier eight-request failure is preserved under
~/.local/state/paxlet-tests/ticket-007-load/. Tests PR7, Taskand tickets 051/052
and production 8084 remain separate preserved delivery states. This ticket
provides bounded admission, not a production capacity guarantee or timeout retry.
