# Native Paxlet node catalog (development)

`app.paxlet_catalog` is the opt-in foundation for replacing Taskand's per-organism
registries with one catalog. It uses Paxlet's verified immutable store and digest;
it does not wrap archives in a second Taskand package or calculate another package
hash. Existing gateway, MCP, generated registries and gossip are unchanged until
their coordinated cutover. Do not point this development CLI at a live node's data.

The operator CLI and Python API support:

- persisted node identity and explicit namespace ownership;
- verified package installation, manifest-derived actions and pinned resolution;
- separate local activation and explicit registration of declared package aliases;
- bounded full snapshots, atomic catalog acceptance and permanent withdrawals.

No operation executes scripts or discovers/connects to peers. SQLite stores
assignments and local policy; Paxlet owns content bytes. Snapshots contain neither
local paths nor approvals, aliases, credentials, grants, receipts or queues.

## Run locally

Use a Paxlet development checkout containing the verified store API (tested with
`48e7203410d43a56473e81bdc3783fd09adaddaf`). The existing shell environment may
provide Paxlet; an explicit source path also works. No new runtime dependency is
introduced: SQLite is part of Python and Taskand already consumes Paxlet.

```bash
export PYTHONPATH=/path/to/paxlet-checkout
export PAXLET_STORE_DIR=/tmp/example-node/store

python3 -m app.paxlet_catalog --root /tmp/example-node/catalog init
```

`init` returns the persisted node ID. Configure that ID as the owner of a namespace
before publishing. The optional `init --node-id node-a` selects an identity only
for a new database; opening it with another ID fails.

```bash
python3 -m app.paxlet_catalog --root /tmp/example-node/catalog trust example NODE_ID
python3 -m app.paxlet_catalog --root /tmp/example-node/catalog install \
  /path/to/hello.paxlet.zip --digest sha256:EXPECTED_DIGEST
python3 -m app.paxlet_catalog --root /tmp/example-node/catalog list
python3 -m app.paxlet_catalog --root /tmp/example-node/catalog approve \
  urn:paxlet:example:hello --version 1.0.0 --digest sha256:EXPECTED_DIGEST \
  --binding paxlet://example/hello
python3 -m app.paxlet_catalog --root /tmp/example-node/catalog resolve \
  'paxlet://example/hello/actions/hello?version=1.0.0'
```

Replace `NODE_ID` and `EXPECTED_DIGEST` with the actual node ID and 64 lowercase
hexadecimal digits from the reviewed package. Resolution returns
`package`, `action`, `version`, `digest`. Pass execution input separately.
An alias is registered only through an explicit local approval; its namespace
must match the package owner's namespace. More than one approved version requires
an exact version or digest. Missing content, corruption and digest conflicts fail.

`deactivate URN --version VERSION --digest DIGEST` revokes local activation,
including for a package owned by another node. Peer retries cannot reactivate it.
`withdraw` with the same arguments publishes a permanent removal marker and is
available only to the namespace owner. It also removes local activation/aliases.
Publishing the same identity/version again is forbidden; use a new version.
Content bytes and existing execution evidence are retained.

## Snapshot exchange

```bash
python3 -m app.paxlet_catalog --root /tmp/example-node/catalog snapshot > /tmp/catalog.json

# On a separate recipient, with its own PAXLET_STORE_DIR and catalog directory:
python3 -m app.paxlet_catalog --root /tmp/recipient/catalog init
python3 -m app.paxlet_catalog --root /tmp/recipient/catalog trust example SOURCE_NODE_ID
python3 -m app.paxlet_catalog --root /tmp/recipient/catalog apply /tmp/catalog.json \
  --origin SOURCE_NODE_ID --archives /path/to/received-archives
```

The archive directory contains `<digest-hex>.paxlet.zip` files. Copy these from the
source's Paxlet objects (`objects-v1/<digest-hex>/package.paxlet.zip`); do not rebuild
packages at the destination. The snapshot checksum detects changed declarations;
it is not a signature or evidence of publisher identity. `--origin` is an explicit
operator assertion about the independently authenticated source. A future transport
must bind that argument to its authenticated peer, never to the snapshot's claim.

The wire envelope is `taskand.paxlet-catalog/v1`, with `origin`, integer `revision`,
`entries` and `checksum`. Each entry contains `urn`, exact `version`, Paxlet
`digest`, its last `revision`, and boolean `withdrawn`. The checksum is SHA-256 of
sorted-key compact UTF-8 JSON for the envelope without `checksum`, with Unicode
unescaped and non-finite numbers forbidden. JSON duplicate keys are rejected.
Limits are 1 MiB and 1,000 entries per origin, including withdrawals. Revision
numbers are bounded to `2^53-1`; full snapshots retain every declared version.

Each snapshot exports only that node's own declarations. Receivers enforce their
configured namespace owners, exact identity/version/digest, monotonic revisions
and retained withdrawals. Unknown origins, stale snapshots, changed content under
an existing version, conflicting payloads at one revision and omitted old entries
fail. New recipients can accept removal markers without downloading retired bytes.
Full snapshots let an offline node catch up directly to the latest revision.

Acceptance first verifies and installs immutable bytes, then commits all catalog
entries and the accepted origin revision in one SQLite transaction. An interrupted
transfer can leave unused verified objects; it cannot expose a partial catalog.
Concurrent imports recheck the revision under the write lock. Imports preserve
local approvals only for unchanged, still-live content; withdrawals remove them.
Retries are idempotent. Received packages initially require explicit local approval.

## Boundaries and verification

Do not replicate the live SQLite database. Its persisted identity, namespace
configuration and activation state belong to one node. Backups must preserve its
accepted revisions and withdrawals: restoring an older database can lose rollback
protection. This slice provides no backup recovery protocol or key rotation.

Resolved plans are data, not execution permission. The future shared invocation
boundary must recheck current local approval/grants and the pinned digest at the
time of execution. This module provides no remote execution, exactly-once promise
or automatic conversion of existing `proc.yaml` packages.

```bash
PYTHONPATH=/path/to/paxlet-checkout PYTHONDONTWRITEBYTECODE=1 \
  python3 -B -m unittest discover -s tests -p paxlet_catalog_test.py -v
```

The suite exercises real Paxlet packages, concurrent catalog writers, corrupt and
partial imports, scoped namespace/alias decisions, version conflicts, withdrawal
replays and three independent node processes exchanging original archives. The
three-node test uses explicit local transport and fresh processes for every CLI
operation, so it checks durable restart/offline behavior, not HTTP or LAN discovery.
