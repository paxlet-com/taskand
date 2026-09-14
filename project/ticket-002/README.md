# Ticket 002: Operacyjny nadzor dostawy i incydentow: read-only pilot

- **ID**: ticket-002
- **Owner**: unresolved:human
- **Status**: BACKLOG
- **Workflow state**: BACKLOG
- **Created**: 2026-09-13

## Goal and scope

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
