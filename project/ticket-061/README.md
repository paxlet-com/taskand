# Ticket 061: Aktualizacja hasza integralności shell workflow w adapterach MCP

- **ID**: ticket-061
- **Owner**: agent:antigravity
- **Status**: IN_PROGRESS
- **Workflow state**: VALIDATION
- **Created**: 2026-09-27

## Goal and scope

Zaktualizowanie przypiętego skrótu SHA-256 dla pliku `app/shell_workflow.py` w wygenerowanych adapterach MCP (`generated/mcp/shell-build/taskand.dev/v1/bin.mjs` oraz `generated/mcp/shell-run/taskand.dev/v1/bin.mjs`) po wdrożeniu adaptera Paxlet i `AttemptStore` (PR #60). Odświeżenie `bindingHash` w rejestrze organizmu `generated/mcp/registry.json` oraz przywrócenie pełnej zielonej konformacji testów kontraktowych `node tests/contract_tests.mjs` (34/34 PASS).

## Acceptance criteria

- [x] AC-01: Zaktualizowano SHA-256 `app/shell_workflow.py` (`ea8adbb85c1a006547003c529629d83fc686eebdcd28e3a97beded62ea686f45`) w obu adapterach MCP oraz wstrzyknięto PYTHONPATH dla poprawnego ładowania modułów aplikacji.
- [x] AC-02: Odświeżono `bindingHash` w `generated/mcp/registry.json` za pomocą procedury `refresh`.
- [x] AC-03: `node tests/conformance.mjs` przechodzi w 100% (4/4 ✓).
- [x] AC-04: `node tests/contract_tests.mjs` przechodzi w 100% (34/34 PASS ✓).
- [x] AC-05: `./project/governance-check.sh` kończy się sukcesem (GOV-PASS: passed 0 errors, 0 warnings).

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
