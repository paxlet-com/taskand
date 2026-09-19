# Ticket 032: Serve MCP pilot panel at gateway root

- **ID**: ticket-032
- **Owner**: codex
- **Status**: IN_PROGRESS
- **Workflow state**: PUBLICATION
- **Created**: 2026-09-19

SESSION_EXECUTION_AUTHORIZATION: user reports Endpoint not found: GET / at the delivered MCP pilot. PLF-011 records this bounded correction to ticket030 local deployment. No parallel writer; previous lease explicitly released.

- [ ] AC-01: Root and index aliases return the real panel; browser requests stay on this pilot; unknown paths and unauthenticated API access remain rejected; the corrected 8084 release and native MCP round trip pass.

Minimal shared behavior is reconciled with preserved PR38 source; its dashboard and 8082 runtime are unchanged.

Validation before deployment: real HTTP regression failed with 404 before the fix, then all 14 readiness tests and 7 release identity tests passed. Real Chrome preview returned the bundled panel, sent mesh requests only to the selected pilot, preserved 401 without authorization, retained 8090 -> 8077 compatibility and had zero JavaScript errors. Managed governance passed. The deployment acceptance is recorded externally after this exact source commit.
