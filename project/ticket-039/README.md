# Ticket 039: Execute natural language tasks through admitted MCP tools

- **ID**: ticket-039
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-09-21

## Goal and scope

SESSION_EXECUTION_AUTHORIZATION: user requests Taskand to handle general tasks. Implement a bounded model/tool loop reusing authenticated MCP gateway and its admitted tools. Preserve caller grants and goal; persist receipts; stop on uncertain effects. CLI provides explicit gateway, model gateway, server scope and run identity.

## Acceptance criteria

- [x] AC-01: Real MCP read/write workflow through model-selected admitted tools.
- [x] AC-02: Unknown tool, step limit, uncertain effect and replay are handled without duplicate execution.
- [x] AC-03: Completion does not claim independent acceptance without evidence.

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.

## Usage

From the repository root, supply the caller credential in `TASKAND_AUTH_TOKEN`
and run `python3 -m app.mcp_task_executor "your task" --server files
--run-id unique-task-id --state-dir /path/to/private/receipts` (on one line).
Use `--gateway` and `--model-gateway` to select authenticated services; defaults
are loopback ports 8082 (MCP pilot) and 8077 (model). Repeat `--server` to expose
additional configured servers. The executor never registers or admits tools.

This is an opt-in CLI executor, not a replacement for `/api/chat` or the Premesh
planner. Its capabilities are those of the selected, admitted MCP tools. Code
editing, test execution and browser scenarios require corresponding server tools.
A completed run reports observed effects; `acceptance=NOT_EVALUATED` means an
independent task-specific acceptance check is still needed. Reusing a run id
returns its stored receipt. After an uncertain effect inspect the MCP run receipt
before considering another run; do not blindly retry with a new id.

## Validation

- `make test`: passed existing conformance, contracts, negative, twin, web and CLI suites.
- Executor unit tests: eight passed, including malformed model JSON regeneration,
  tool admission, bounded execution, goal binding, uncertain effects and replay.
- Real services: GLM via 8077 selected MCP calls via 8082 in run
  `ticket039-live-3`: read CSV values 350 and 480, write JSON report, read it back.
  Independent filesystem assertion confirmed `{"total": 830}`. Receipt replay
  returned the stored result. First two attempts stopped before effects on invalid
  model JSON; the executor now requests a corrected response, bounded to three tries.
- Filesystem pilot operator admission was extended to `write_file`; no automatic
  admission or new execution privileges are implemented by this code.
