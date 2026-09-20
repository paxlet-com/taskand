# Ticket 028: Taskand MCP stdio gateway adapter

- **ID**: ticket-028
- **Owner**: codex
- **Status**: IN_PROGRESS
- **Workflow state**: VALIDATION
- **Created**: 2026-09-19

## Goal and scope

Implement the local stdio MCP gateway adapter requested in Planfile PLF-004.
Expose process discovery, metadata and URI invocation using the existing HTTP
gateway authorization boundary, bounded requests and structured MCP failures.
Keep the gateway and generated process packages unchanged. Verify with a real
MCP client and a local runtime read-only canary; register the local client
using the documented public guest profile if that profile is accepted.

SESSION_EXECUTION_AUTHORIZATION: user requested this investigation and then
said "kontynuuj" on 2026-09-19. This authorizes implementing and checking the
adapter and local client integration. Publication, production replacement,
secret access and autonomous repository-writing workers are outside this slice.

Preflight for packages/taskand-mcp/** and tests/taskand_mcp_test.py returned
NEW_TICKET_CANDIDATE with no blockers. Existing primary checkout changes and
the ticket-019 documentation branch are disjoint and remain owned by others.

## Ownership handoff

2026-09-19: the user explicitly approved "Zatwierdzam przekazanie do
ticket-028" for lease-9fb79eecac4ede3cf1eaf29b698182e8. Re-observation
confirmed revision 3, fencing 277, merged PR 19 and absent old worktree.
The pinned controller acquired the reservation for this ticket. The final
intent, including explicit HTTPX dependency, is bound to
lease-ddfe634a3fe1369b8c2930becc1fbe49, initially editing, revision 2,
fencing 282. Current transitions and receipts are external controller state.

## Acceptance criteria

- [x] AC-01: An MCP client initializes and discovers list/describe/call tools.
- [x] AC-02: Registry URI discovery and calls use only the configured gateway;
  authentication, redirects, input/output bounds and failure handling are tested.
- [x] AC-03: Read-only live canary and client setup are documented accurately;
  no claim of transitive grant enforcement or a parallel development scheduler.
- [x] AC-04: Focused tests and managed governance pass; existing data is preserved.

## Validation evidence

- Official SDK 2.2.0: real MCP stdio client discovers all three tools.
- Nine focused tests PASS, covering HTTP authentication and denial, protocol
  validation, structured process failures, redirects, request/response size,
  invalid JSON, catalog integrity and deadline without automatic retries.
- Managed governance PASS with zero errors and warnings.
- Wheel and source distribution built successfully from the isolated package.
- Live guest canary: 29 catalog processes, codegen metadata read, public
  chat/message acknowledgement succeeded, codegen invocation rejected HTTP 403.
  The public acknowledgement process does not delegate work or call an LLM.
- Runtime health is reachable but reports MISMATCH_OR_INVALID with no commit
  identity; this adapter does not repair or certify that deployment.
- Client registration/installation receipts belong in the external
  recovery store referenced by receipt:mcp028.local-installation. MCP registration is not proof
  of a tool-catalog refresh in an already-running Codex session.

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
