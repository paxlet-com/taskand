# Ticket 060: Wbudowanie adaptera Paxlet i AttemptStore w Taskand

- **ID**: ticket-060
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-09-27

## Goal and scope

Wdrożenie modułu adaptera Paxlet (`app/paxlet_adapter.py`) z mechanizmem trwałego rejestrowania prób wykonania `AttemptStore`, integracja operacji `run_urn` w `app/shell_workflow.py` oraz zestaw testów jednostkowych weryfikujących emisję i zapis paragonów Paxlet.

## Acceptance criteria

- [x] AC-01: Utworzono moduł `app/paxlet_adapter.py` z klasami `AttemptRecord`, `AttemptStore` oraz `PaxletTaskandExecutor`.
- [x] AC-02: Zintegrowano zapis paragonów w `AttemptStore` podczas wykonywania pakietów w `app/shell_workflow.py` oraz dodano operację `run_urn`.
- [x] AC-03: Utworzono zestaw testów `tests/test_paxlet_attempt_store.py` (19/19 testów przeszło).
- [x] AC-04: Weryfikacja governance `./project/governance-check.sh` kończy się sukcesem (GOV-PASS).

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
