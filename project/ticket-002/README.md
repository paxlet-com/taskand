# Ticket 002: Operacyjny nadzor dostawy i incydentow: read-only pilot

- **ID**: ticket-002
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: PUBLICATION
- **Created**: 2026-09-13

## Goal and scope

SESSION_EXECUTION_AUTHORIZATION (2026-09-14): the user requested continued
functional recovery and fast, standards-respecting diagnostic delivery.
Reuse this allocated application ticket for a bounded F-04 readiness slice:
`app/runtime_readiness.py` and `tests/runtime_readiness_test.py`. Work only in
the canonical `ticket-002--runtime-readiness` checkout. No shared manifest,
delivery controller, lease adapter, token, service configuration or deployment
is changed. Original supervisor roadmap below is retained, not claimed done.

Run `python app/runtime_readiness.py --expected-sha <full-commit-sha> --stream`.
The result distinguishes immutable source from observed loopback HTTP behavior,
streams bounded probe results and never grants deployment/merge authority.

Current slice acceptance:

- [x] AC-09: Compare served HTML with the exact committed blob, not dirty files.
- [x] AC-10: Classify health, absent/protected API and unknown gateway identity
  without sending credentials, following redirects or exposing response bodies.
- [x] AC-11: Parallel probes share one deadline, bound bytes, stop stalled/drip
  responses and stream completed results without awaiting the slowest probe.
- [x] AC-12: Regression tests and managed gate pass; no runtime is mutated and
  local readiness is never described as authenticated functional verification.

Verification: 12 unittest cases PASS (5.900 s), Ruff 0.15.11 PASS, managed
governance PASS (zero findings). The read-only live probe against source
`557a386aaa9f8cea881c4069b681a951191f1c22` completed in 868 ms: old served HTML,
missing gateway SHA, context and mesh 404. This is an observed readiness failure,
not a failed unit test and not authorization to deploy. Independent PR acceptance
is still required; keep this implementation ticket IN_PROGRESS / PUBLICATION.

Report-binding follow-up: the same 12 cases pass in 6.330 s with assertions for
the exact loopback endpoint, observation ID/time, source SHA and probe deadline.
The first protected CI run passed the new tests within 62 Python tests, but the
aggregate failed the existing Chromium namespace case and two WWW cases. No
test was skipped or waived. PR #10 carries this slice; CI and review must bind
the latest head, not the earlier successful local checks.

### Preserved supervisor roadmap (outside this publication slice)

The following historical proposal and AC-01..AC-08 remain future work. They do
not expand this slice's allowedPaths or imply that the full supervisor is done.

Propozycja użytkownika: operacyjny nadzór nad dostawą i trudnymi incydentami
podczas pracy Taskand nad powierzonym projektem. Przydzielono przez zarządzany
`project/new-ticket.sh`; bez nowego brancha, worktree i writera.
Uczestnicy: użytkownik (autoryzacja sesyjna przygotowania propozycji),
agent:taskand (projekt). To nie jest niezależna zgoda na publikację ani deployment.

Etap 1: obserwator read-only, normalizacja incydentów, trwałe powiązanie
obserwacji z repo/ticket/zakresem oraz replay reguł TKD-013 i TKD-014.
Wynik: wersjonowany raport JSON i tekst dla shell, gotowy do późniejszej
projekcji w web. Monitor ma odróżniać commit, push, PR, merge i deployment.

Warunki rozpoczęcia implementacji: rozliczenie dostawy ticket-001 przez
zweryfikowany merge lub lossless split z jawną zależnością, opublikowany pin
standardu i świeże admission/intent/lease. Obecny intent pozwala wyłącznie
utrzymać tę propozycję; konkretne ścieżki adaptera oraz kryteria wdrożenia
zostaną rozwiązane z aktualnego repo przed pierwszym zapisem implementacji.
Nie otwieramy drugiego aktywnego zakresu pod pretekstem naprawy pierwszego.

Projekt i macierz walidacji:
[operacyjny nadzorca](../../docs/information/complementary-runtime.md).

Poza etapem 1: automatyczny rebase/cherry-pick, zapis do obcych repozytoriów,
push/merge/deploy, kasowanie worktrees, globalna aktywacja hooków lub OneDev,
zbieranie prywatnych sesji, self-update i nowe urządzenia. Kolejne etapy
wymagają wyników pilota, ograniczonego intentu i osobnej kwalifikacji efektów.

## Acceptance criteria

- [ ] AC-01: Odczyt całego base..HEAD oraz staged/unstaged/untracked; wspólna historia nie jest nowym writerem, brak dostępu jest UNKNOWN.
- [ ] AC-02: Normalizacja JSON/text/exit/CI z redakcją, parserVersion i evidenceRef; nieznany format nie staje się sukcesem ani komendą.
- [ ] AC-03: Jeden incydent zachowuje budżet po nowym prompcie, ticketcie, restarcie i zmianie węzła; test utraty store blokuje rekomendację efektu.
- [ ] AC-04: Twin odtwarza co najmniej timeout po udanym pushu, disabled CI, stale HEAD, utratę eventu, konflikt ownership i regresję bez wykonywania operacji produkcyjnych.
- [ ] AC-05: Raport zawiera freshness, input/policy digests, regułę, proponowaną trasę, brakujące dowody i `grantsAuthority:false`; odczyt/evaluacja nie zmieniają indeksu, refs, worktrees ani konfiguracji celu.
- [ ] AC-06: Rejestrowane URI/URN mają schemat i rzeczywisty resolver; nie istnieją wyłącznie jako nazwy w prozie. Brak opublikowanego pinu blokuje deklarację adopcji.
- [ ] AC-07: Pomiar opóźnienia i test okresowej resynchronizacji wykrywają pominięty event; test dwóch równoległych obserwatorów nie tworzy zduplikowanego incydentu/eskalacji.
- [ ] AC-08: Diagnoza CI korzysta z efektywnej konfiguracji runtime i profilu dokładnego repo, nie samego pliku: test `enabled=false` + override `true` nie zgłasza wyłączonej usługi; brak profilu testowego pozostaje odrębną blokadą.

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
