---
{
  "schema": "wellmanifest.docs/document/v1",
  "id": "portable-lease-runtime",
  "kind": "information",
  "version": 1,
  "title": "Portable pinned lease runtime",
  "status": "proposed",
  "owner": "semcod/taskand-glm53",
  "created": "2026-09-14",
  "updated": "2026-09-14",
  "review_after": "2026-09-21",
  "source_revision": "293e17af0925276b52db0eda3f91b7ce57346143",
  "affected_repositories": ["semcod/taskand-glm53"],
  "evidence": ["repo://semcod/taskand-glm53/project/ticket-008/intent.json", "repo://semcod/taskand-glm53/tests/lease_runtime_test.py", "https://github.com/subactor/onedev-agent/issues/304"]
}
---

# Portable pinned lease runtime

<!-- docs:section purpose -->
## Purpose

Remove a reproducible OneDev prerequisite failure: the local lease adapter
previously imported its backend from one developer's absolute home path.
An isolated checkout must be able to exercise the real lease store without
network downloads, fabricated installation directories or skipped tests.

<!-- docs:section scope -->
## Scope and ownership

`project/vendor/autonom/change_lease.py` is an unmodified ADOPT copy of
`subactor/autonom:autonom/change_lease.py` at immutable revision
`4e7f1aa4e230de22281366c34a117df6afc3de16`. Its SHA-256 is
`013c82127cb2d398e83479d82fd2d1008773cae08d322d391a6616427b614a37`.
These are the same revision and bytes previously required by the adapter.
Autonom remains the HOME of the implementation. Do not edit the vendor copy;
semantic changes belong upstream and require an explicit reviewed adoption.

The adopted Wellmanifest transition policy remains in
`.governance/change_lease_check.py`, bound by the existing manifest lock.
This change adds no dependency version, package installation or authority.

<!-- docs:section content -->
## Loading and diagnostics

The adapter selects the backend relative to its own file. There is no fallback
to developer installations, environment-selected code or network retrieval.
Backend and policy hashes are checked before importing either module. Import
executes exactly the verified byte buffers, avoiding a second source read or
an unchecked bytecode-cache load. Visible symlinks in the paths are rejected.

Stable diagnostics distinguish `LEASE_BACKEND_UNAVAILABLE`,
`LEASE_BACKEND_DIGEST_MISMATCH` and `LEASE_BACKEND_SYMLINK`. Equivalent
`LEASE_POLICY_*` diagnostics identify policy failures; `LEASE_POLICY_LOCK_*`
identifies missing or symlinked lock input. Repair the installation/adoption,
not the expected digest merely to suppress a failure.

The explicit external store, cooperative locking, fencing, accepted local
actions and publication authority boundary are unchanged. The backend's older
transition implementation is still not invoked by the adapter.

<!-- docs:section evidence -->
## Verification

The regression first reproduced the home-path dependency, accepted symlinks
and execution of a file changed after its digest check. Tests exercise the
actual pinned module and adopted policy, not substitute lease implementations.
Run `python -m unittest discover -s tests -p lease_runtime_test.py` and the
existing `context_test.py` suite in a clean-HOME, networkless, unprivileged
container without host mounts. Keep the managed governance check mandatory.

Observed local rehearsal: all 10 new tests passed, followed by all 31 existing
context tests in 12.454 seconds in executor image
`sha256:e4bd9083b6bae9cca7dbfcdf36a6b258f7aeb390e2e5112ca5c6c1244ec3ff3e`.
The disposable container had no network or host mounts, uid 10000, all
capabilities dropped, no-new-privileges, 2 CPUs, 2 GiB memory and a clean HOME.
Managed governance and focused Ruff checks passed. This rehearsal is not an
authenticated OneDev head/base verification receipt.

<!-- docs:section limitations -->
## Limits

This is single-host cooperative coordination, not distributed consensus.
An independently reviewed application update is still needed to accept new
backend bytes; the local digest does not grant merge or deployment authority.
The symlink check is not a filesystem-wide race-proof sandbox. A concurrent
source replacement cannot replace the checked buffer that is executed.

No browser confinement, OneDev profile deployment, live observer or production
gateway change is included. A passing lease test removes one prerequisite;
it does not establish full Taskand CI coverage.

<!-- docs:section next_actions -->
## Delivery

Publish through independent exact-head verification, then exercise the complete
protected Taskand profile with its remaining browser confinement prerequisites.
The concurrent ticket-007 delivery coordinator is a separate implementation.
