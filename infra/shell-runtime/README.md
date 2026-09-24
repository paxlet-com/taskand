# Shell runtime staging

Stage a reviewed, exact Taskand commit outside a mutable checkout. The tools
never replace a running service. Python 3.12+, Git and Node are required.

```sh
python3 infra/shell-runtime/stage.py /path/to/taskand FULL_COMMIT_SHA /path/to/new-release
bash /path/to/new-release/packages/taskand-shell/install.sh /path/to/paxlet /path/to/nl-dsl-sh
python3 infra/shell-runtime/canary.py /path/to/new-release \
  --python /path/to/new-release/.subactor/cache/shell-venv/bin/python
```

Use trusted local dependency checkouts. The installer requires Paxlet 0.1.4 and
nl-dsl-sh 0.2.0; their transitive dependencies are not locked. Record their source
revisions and `pip freeze` alongside the release when preserving a deployment.
Source staging records the Git archive digest and every archived file hash.
It rejects an existing destination, symlinks and tracked runtime state/`.env`.
The health manifest binds gateway/UI files to the source commit; this is local
integrity evidence, not a signed release attestation.

The canary uses an OS-assigned loopback port, a random in-memory token, temporary
shell packages and fresh release-local audit state. It verifies health identity,
anonymous-call denial, export, package verification, digest-bound execution and
the Paxlet receipt, then stops its gateway. It prints a JSON receipt. It is a
one-use test: stage a fresh directory to repeat it. Preserve the canary receipt
before removing temporary releases. Never pass a production release or its logs.

To check an existing Taskand OpenAI-compatible provider configuration explicitly:

```sh
/path/to/new-release/.subactor/cache/shell-venv/bin/python \
  infra/shell-runtime/live_provider.py --taskand-env /private/path/to/taskand.env
```

This reads `TASKAND_LLM_ENDPOINT`, `TASKAND_LLM_MODEL` and
`TASKAND_LLM_API_KEY` without copying them. It makes one planning request
(45-second provider timeout, 3000 output tokens, no repair retries), compiles
the plan and emits its content and digest. It never executes generated code.
Provider diagnostic text and exception messages are suppressed to keep credentials
out of receipts. The probe is explicit opt-in and may consume provider credits.

Before replacing an existing gateway, select its service and compare its process
catalog, configuration, state paths and dependency runtime with the staged
release. Preserve these bindings and the exact previous service definition.
Switching a service and verifying rollback are separate operations: successful
staging or a canary does not mean a gateway was deployed. In particular, the
local 8084 MCP runtime contains imported processes outside the main checkout.

Validation:

```sh
python3 -m unittest discover -s infra/shell-runtime -p 'test_*.py'
./project/governance-check.sh
```

## Preserve an existing MCP runtime

`compose.py BASE_RELEASE SHELL_RELEASE NEW_RELEASE --base-manifest-sha256 PIN`
adds the shell adapter, CLI, package examples and two shell URI wrappers from a
staged merged source to a copy of the existing runtime. It preserves existing
registry entries (including imported MCP contracts), gateway code, UI and grants.
It excludes logs and configuration secrets. Existing shell URI collisions,
changed source hashes and symlinks fail closed. The manifest reports the original
gateway commit separately from `shellSourceSha`; it never claims the whole runtime
came from the newer shell commit.

Run the canary on this composition, then verify an existing imported MCP tool
with the service's original MCP Python/profile settings. Preserve the existing
service environment. Point `TASKAND_SHELL_PYTHON` at the installed shell runtime,
`TASKAND_SHELL_WORKSPACE` at a dedicated persistent directory and optionally
`TASKAND_SHELL_ENV_FILE` at a private (0600) `NL_DSL_SH_*` configuration file.
Do not put credentials in a systemd command line, Git or deployment receipts.

For a systemd user service, record its exact unit, working directory, manifest
pin, drop-ins and catalog before switching. A separate runtime drop-in can replace
`ExecStart` and `WorkingDirectory` and set the new manifest/shell paths while
retaining other environment settings. Keep the previous release and original log
path: move its existing log directory to the candidate only while the service is stopped,
and bind the move to the directory device/inode in the rollback record. Symlinks
are rejected by the context store.
Do not copy live context databases. Re-observe the source, service and catalog
immediately before restart. Verify health identity, the complete previous catalog,
a shell execution receipt and an existing MCP call after restart. On failure,
stop the service, restore the same data directory to its prior path,
remove only the unchanged drop-in created for this rollout, reload systemd, restart
and verify the previous manifest pin. Save this exact rollback operation externally.

The rollout may add precisely the two shell URIs to the existing operator's grants
without changing that operator's credential or prior grants. Record this explicit
configuration overlay and its file digest separately from source provenance.
The 8084 rollout observed `PROFILE_CHANGED` for existing Git/Tillm MCP imports
before deployment; preserve and report that baseline independently of shell checks.

For a transient systemd unit, use `restart`, not separate `stop`/`start`: systemd
may unload the transient definition on stop. Configure `move_state.py` as
`ExecStartPre` with the exact source, destination, device and inode. It performs
an atomic rename after the old process exits and permits retries only for the
same directory identity. Rollback uses a temporary reverse `ExecStartPre`, the
original command/environment, and another restart; remove the rollback drop-in
only after verification. The move refuses symlinks, changed identity and two
existing directories. Keep the installed state mover for subsequent restarts.
