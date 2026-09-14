---
{
  "schema": "wellmanifest.docs/document/v2",
  "id": "performance-evolution",
  "kind": "refactoring-plan",
  "version": 1,
  "title": "Wydajność i kontrolowana ewolucja (E-01, E-09)",
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

# Wydajność i kontrolowana ewolucja (E-01, E-09)

<!-- docs:section summary -->
## Cel i stan

Zwiększać liczbę poprawnie zakończonych zadań przy ograniczonym koszcie.
To podział istniejącego planu, nie potwierdzenie wdrożenia E-01/E-09.
Wejście: lokalny odbiór F-01–F-04 według [pytań V](../information/post-deployment-validation-questions.md).

<!-- docs:section details -->
## Zakres i rozwiązanie

Zachować URI, kontrakty i komplementarną pętlę. Osobno planować, wykonywać,
przechowywać artefakty, weryfikować zaufanie i wdrażać. Broker lub stały runner
są kandydatami po pomiarze spawn-per-request, registry, hashy i fan-out.
E-01 zapisuje source/runtime/config digests oraz porównywalny baseline.

Mierzyć ukończone zadania/czas, queue latency, error/timeout rate, CPU/RAM/I/O,
cache i koszt zadania. Osobno wiek zmiany, lead time PR/merge/deploy, writerów,
blokady, desired/observed digest, offline i catch-up. UI pokazuje zakres,
czas, źródło i UNKNOWN; średnia nie ukrywa krytycznej awarii.

E-09: hotspot → baseline/candidate → twin → quality gate → niezależny review →
wydanie → ograniczony rollout → pomiar → cooldown/rollback. Wymaga E-01–E-03
i E-06–E-08; flota dodatkowo E-05.

Historyczna inspekcja performance@3573a2 wskazywała poprawki GBNF dla slash,
NaN/overflow, interpretacji trzech próbek, wykluczeń generated i budżetów.
15/15 testów ticket-003 oraz gate ticket-002/003 były dowodem lokalnym,
nie publikacji. Aktualny stan parity schema/runtime/GBNF sprawdzić osobno.

<!-- docs:section validation -->
## Weryfikacja

E-01: powtarzalne pomiary V-01–V-17/V-54, bez p99 z trzech prób.
E-09: praktycznie istotna poprawa bez regresji i skończony koszt eksperymentu;
V-44–V-56 adekwatnie do zakresu. Budżety wynikają z pomiarów, nie uniwersalnego
timeoutu lub liczby kontenerów. Sam nowy README nie zamyka etapu.

<!-- docs:section risks -->
## Ryzyka i odpowiedzialność

Właściciele: Taskand i wellmanifest/performance. Luki audytora obejmują
traversal, rozmiar wejścia, typy i provenance. Validate nie wykonuje
inwariantów ani nie pobiera artefaktów. Zachować przypięty zestaw i snapshot;
rollback kodu, danych i uprawnień jest odrębny. Następnie E-01 i projekt E-02.
