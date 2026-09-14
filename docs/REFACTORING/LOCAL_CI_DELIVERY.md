---
{
  "schema": "wellmanifest.docs/document/v2",
  "id": "local-ci-delivery",
  "kind": "refactoring-plan",
  "version": 1,
  "title": "Lokalne CI i niezależna publikacja (część E-06)",
  "status": "proposed",
  "owner": "semcod/taskand-glm53",
  "scope": "repository",
  "updated": "2026-09-14",
  "source_revision": "c9fa3f47cb087122c49e70be97030ced9d88ef34",
  "priority": "P2",
  "evidence": [
    "github://semcod/taskand-glm53/commit/c9fa3f47cb087122c49e70be97030ced9d88ef34",
    "repo://semcod/taskand-glm53/docs/refactoring/functional-recovery-plan.md"
  ]
}
---

# Lokalne CI i niezależna publikacja (część E-06)

<!-- docs:section summary -->
## Cel i stan

Reużyć subactor/onedev-agent jako executor/scheduler i validator-agent jako
niezależne review. Taskand deleguje i pokazuje dowody; nie zatwierdza własnej dostawy.

<!-- docs:section details -->
## Zakres i rozwiązanie

1. Profil określa stack, przypięte środowisko, testy, uprawnienia i źródło
   required checks. Brak profilu to onboarding.
2. Webhook/ograniczony polling deduplikuje repo/head/base.
3. Odizolowany executor bez poświadczeń testuje dokładny wynik scalenia,
   z limitami sieci/zasobów. Kod PR nie czyta tokenu ani Docker socket hosta.
4. Chroniony kontroler zapisuje wynik/provenance. Validator sprawdza
   head/base, policy/intent i testy.
5. Chroniony merge daje receipt; build/release/deployment są osobne.
   Zmiana head/base unieważnia wynik i wymaga nowego testu.

Historyczny plan odnotował onedev/local-verify i scheduled_scan=false.
Konfiguracja i obecność run-local-direct-pr.sh nie dowodzą canary ani
automatycznej kolejki. Sprawdzić obecny profil i rzeczywiste receipts.

Zewnętrzny executor uniezależnia wykonanie od Actions, nie od sprzętu,
sieci, GitHub API i uprawnień. Self-hosted Actions nadal używa control plane
Actions. Warunki billing sprawdzać przy operacji, bez utrwalania dawnych cen.

<!-- docs:section validation -->
## Weryfikacja

E-06 wymaga F-10/E-02 i [onboardingu](REPOSITORY_ONBOARDING.md).
Odebrać head/base receipts, nie syntetyczne zielone statusy.
V-02–V-06, V-38–V-39, V-52–V-53. Nowy head/base odrzuca stary wynik.
Migracja required checks wymaga niezależnego canary z równoważnym pokryciem OS.

<!-- docs:section risks -->
## Ryzyka i odpowiedzialność

Owner: onedev-agent/validator-agent; Taskand utrzymuje adapter. Billing
nie znosi bramek. Offline daje lokalne dowody, nie merge niewysłanego PR.
Ten plan nie uprawnia do sekretów ani zmiany protected checks.
Rollback zachowuje poprzednią zweryfikowaną ścieżkę CI.
