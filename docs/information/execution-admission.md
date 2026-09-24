# Gateway execution admission

The gateway admits at most two registry `call` subprocesses and two other
registry subprocesses at a time by default. Nonblocking admission occurs before
process creation, including direct calls through `/api/registry`. Saturation
returns `ok: false`, `errorType: BUSY`, HTTP 503 and starts no process. Separate
control capacity keeps health/catalog requests eligible while calls are busy;
control capacity itself is bounded and can also return BUSY.

Operators may set `TASKAND_MAX_CONCURRENT_CALLS` and
`TASKAND_MAX_CONCURRENT_CONTROL` to integers 1–32 before starting the gateway.
Invalid configuration fails startup. Requests cannot change these limits.
One gateway process owns these slots; multiple gateway workers/containers each
have their own limits. They do not bound arbitrary HTTP threads or independently
started CLI processes. Increasing limits requires a measured CPU/memory/PID budget.

Slots are released after completion, parsing failures, spawn failures and timeouts.
Resource spawn errors become HTTP 503 REGISTRY_UNAVAILABLE; unclassified failed
results become HTTP 502 rather than HTTP 200. Known DENIED/NOT_FOUND statuses are
preserved. A timeout remains OUTCOME_UNKNOWN/504: this change does not establish
that descendant processes stopped or that retrying a mutating task is safe.
Only BUSY explicitly guarantees that this request did not start a registry process.

The prior isolated fixture reproduced 1/8 verified outcomes with eight simultaneous
calls at 1 CPU, 768 MiB and 128 PIDs. The regression targets controlled admission,
not eight successful simultaneous executions. Tests must verify accepted outputs,
zero effects for busy requests, separate health capacity, slot recovery and receipts.
No production gateway deployment is part of this change.
