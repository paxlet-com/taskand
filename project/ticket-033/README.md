# Ticket033: Native MCP dashboard integration

- **ID**: ticket-033
- **Owner**: codex
- **Status**: IN_PROGRESS
- **Workflow state**: PUBLICATION
- **Created**: 2026-09-19

SESSION_EXECUTION_AUTHORIZATION: user confirms joining the newer dashboard with the delivered native MCP catalog. PLF-012. Reuse preserved PR38 navigation without taking over its independent writer or deployment. Ticket030/032 source and acceptance remain preserved.

- [ ] AC-01: Authenticated dashboard shows real MCP server/tool counts, filters, schemas and grants; active tools execute only by explicit action; candidates require admission; stale sessions cannot render results; request state is recoverable without retry. Real browser and deployed read-only MCP canary pass.
- [x] AC-02: The conversation panel identifies the current local `grants.yaml`
  source path, names the default loopback grant, distinguishes an optional
  `TASKAND_AUTH_TOKEN` override from `TASKAND_LLM_API_KEY`, and preserves
  in-memory-only token/logout behavior.

Conversation uses only the fixed LLM URI and caller rights. No automatic tool admission, arbitrary calls, shared default administrator token or token persistence.

Ownership blocker: controller currently holds lease-681e63d163c00cab8faa2a38a7c6f03d, owner codex-goal-mcp-20260919, revision2/fence371, on ticket030. Owner CLI PID802685 remains alive; last turn completed19:53 with dirty staged Goal adapter. Do not reclaim on timeout or write implementation before explicit handoff. Preserve all Goal changes. User authority requested for this distinct owner.

Resolved handoff: user explicitly authorized stopping Goal owner and preserving its changes. Exact owner observed gone after SIGINT; revision2/fence371 cancelled through CAS. Goal files/index preserved in place plus private archive. Current session owns dashboard continuation.

Local validation: all16 runtime readiness/HTTP tests and all20 mesh/browser tests pass. Real Chrome preview shows45servers/422tools,415candidates and7callable tools; filesystem native URI returns the known canary content, state recovery issues no second tool call, and logout clears private view with no browser storage. Mobile390px has no horizontal overflow. Catalog read capability is separate from registry/core execution and exposes only tool metadata plus per-URI permissions. Model conversation remains unavailable on this local instance until configured and authorized; the panel reports this.

The original generic full contract run against a copy of seven admitted tools lacked MCP interpreter configuration and failed; its no-argument probes are unsuitable for arbitrary tool contracts. Full-stack validation therefore uses an isolated422-candidate import fixture, while admitted behavior is tested separately with the explicit read-only browser canary. No deployed admission or private profile changed during this adjustment.

Final source validation: full make test passes with the isolated 422-candidate import fixture, including 30/30 core contracts and 11 Python MCP tests. Goal preservation was subsequently serialized under a temporary ticket030 lease: all four file hashes were verified in an exact named stash before the original checkout was restored to clean. The private archive and staged-index patch remain available. The standard pre-commit overlap gate now passes without bypass. Live deployment acceptance will be bound to the resulting commit in the external delivery ledger.
