# Taskand MCP

Local stdio MCP adapter for the existing Taskand HTTP gateway. Every versioned
process URI is addressable through `call_process`; the gateway decides whether
the configured credential may invoke it. Uses the official Python MCP SDK.

```sh
uv sync --locked --project packages/taskand-mcp
uv run --locked --project packages/taskand-mcp taskand-mcp
```

The command is a stdio server, not an interactive shell. MCP owns stdout.
Run it from an MCP client; no gateway or model credentials are needed to start.

| Tool | Input | Result |
| --- | --- | --- |
| `list_processes` | `offset=0`, `limit=50` (maximum 100) | Public active catalog, total, next offset |
| `describe_process` | Exact `uri` | Published metadata, whether an input schema exists |
| `call_process` | `uri`, explicit `input_data`, `timeout_seconds=60` (1–300) | Gateway envelope and process output |

Process errors, HTTP failures and timeouts return `isError=true` with a
structured result. Pagination is a fresh catalog read, not a stable snapshot.
If the gateway has no process input schema, the adapter reports that fact;
it does not invent a contract or invoke the process to discover one.

## Configuration

- `TASKAND_MCP_GATEWAY_URL`: origin, default `http://127.0.0.1:8077`.
  Plain HTTP is permitted only for loopback addresses; remote gateways need HTTPS.
- `TASKAND_MCP_TOKEN`: explicitly selected gateway credential, optional for
  public discovery, required for calls. There is no default token and no `.env`
  loading. `TASKAND_AUTH_TOKEN` is deliberately not inherited as a fallback.

HTTP redirects and environment proxies are disabled. Input is limited to
256 KiB and uncompressed responses to 1 MiB. Each request has a total deadline;
a call waits up to its process timeout plus five seconds. Neither a timeout
nor cancellation guarantees that a remote process stopped. Calls are never retried.

## Codex

Register an absolute checkout path, replacing `/path/to/glm53` below:

```sh
codex mcp add taskand --env TASKAND_MCP_GATEWAY_URL=http://127.0.0.1:8077 -- uv run --locked --project /path/to/glm53/packages/taskand-mcp taskand-mcp
```

In the client configuration, forward `TASKAND_MCP_TOKEN` through `env_vars`
and set `tool_timeout_sec = 310` for calls using the full 300-second process
budget. Supply private credentials from the host environment, not shell history.
Reload the MCP connection/client and verify the tools appear; registering the
server does not prove an already-running session refreshed its tool catalog.

For a loopback canary, the repository's **public** `taskand-guest-key` may be
selected explicitly. Its only call grant is `proc://taskand.dev/chat/message/v1`.
Never substitute the public administrator profile as an automatic fallback.
Example canary arguments: `{"uri":"proc://taskand.dev/chat/message/v1",
"input_data":{"message":"MCP canary"}}`.

## Delegation boundary

This transports existing processes; it adds no scheduler or repository writer.
For a development helper, an appropriately granted client can invoke
`proc://taskand.dev/dev/codegen/v1` with `uri`, `capability`, and `rules` inside
`input_data`; optional `example_input` and `feedback` refine the request. That
process uses an LLM and returns candidate files without writing them. Review
the result and run project tests before accepting it.

The current gateway checks the outer process URI. Transitive user grants and
per-action authorization for registry/composite processes are not provided by
this adapter. Use narrow credentials; treat administrative/composite access as
privileged. Before repository-writing delegation, add isolated worktrees and
leases, bounded jobs, plan-bound resume and independently reviewed results.

## Verification

```sh
uv run --locked --project packages/taskand-mcp python tests/taskand_mcp_test.py
./project/governance-check.sh
```

Tests start their own HTTP fixture and use a real MCP stdio client. They do not
call a model provider or modify gateway state. A separate live canary should
record the gateway's release identity as well as the MCP result.

The 2026-09-19 local canary discovered 29 processes, described `dev/codegen`,
and invoked `chat/message` with the public guest profile. The chat result was
an acknowledgement, not execution of a development task; `dev/codegen` returned
HTTP 403 with that same profile. All nine fixture tests passed. A separately
installed wheel also completed MCP discovery outside the source checkout.
The observed gateway reported `identityStatus=MISMATCH_OR_INVALID` and no
commit identity, so these results establish connectivity to that runtime,
not that it runs the current repository HEAD or that development is faster.

References: [MCP tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools),
[official Python SDK](https://github.com/modelcontextprotocol/python-sdk/tree/v2.2.0),
[Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).
