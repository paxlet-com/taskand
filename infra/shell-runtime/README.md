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
