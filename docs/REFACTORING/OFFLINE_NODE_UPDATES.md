---
{
  "schema": "wellmanifest.docs/document/v2",
  "id": "offline-node-updates",
  "kind": "refactoring-plan",
  "version": 1,
  "title": "Aktualizacja węzła, offline i rollout (E-03–E-05)",
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

# Aktualizacja węzła, offline i rollout (E-03–E-05)

<!-- docs:section summary -->
## Cel i stan

Projekt aktualizacji zachowującej zadania i odzyskiwanie stanu.
Nie wdraża updatera ani Gitea; [E-02](RUNTIME_PACKAGE_CONTRACT.md) jest warunkiem wejścia.

<!-- docs:section details -->
## Zakres i rozwiązanie

Discover → verify → stage → validate → drain/checkpoint → atomowy switch →
observe → recover. Kanał wskazuje przypięty manifest; bez git pull na aktywnym
kodzie. Weryfikować podpis, bajty, daty, zgodność, klucze, zasoby i uprawnienia.

Osobny cache ma lock/journal. Testować migrację kopii danych i canary.
Stare zadania kończą na przypiętej generacji lub bezpiecznej granicy;
zewnętrzne efekty wiązać idempotency key/receipt. Switch wymaga CAS/fencing
i supervisora niezależnego od workera. Health, autoryzowany scenariusz,
SLO i budżet błędów poprzedzają następny cohort.

Mały węzeł potrzebuje cache, registry metadata i outbox. Opcjonalny hub Gitea
ma osobne dane, backup, obraz i uprawnienia. Pull mirror upstream; lokalny
fork wraca przez PR. Push mirror może nadpisać cel i nie służy publikacji
do chronionego upstream. Git mirror nie zapewnia wheels, OCI, LFS,
submodules, grants, ticketów ani zdarzeń.

Catch-up pobiera pełny zgodny graf z limitem dysku/pasma i wznowieniem.
Może pominąć wydania kodu, nie migracje danych ani rotacje zaufania.
Reużyć zweryfikowany mechanizm typu TUF: anty-rollback/anty-freeze,
ważność grantów i osobne klucze węzłów. Updater nie zmienia trust roots,
required checks ani zgód.

<!-- docs:section validation -->
## Weryfikacja

E-03 wymaga E-01/E-02/F-06: fault injection stage/migracji/drain/switch,
zero zgubionych/podwójnych efektów; V-21–V-23, V-46–V-48, V-55.
E-04 wymaga E-02/E-03: offline, przerwany transfer, klucze/fork; V-47–V-50.
E-05 wymaga F-08/E-03/E-04: nvidia/RPi, osobne identity/cohorts,
jitter/backpressure i receipts; V-29–V-32, V-56.
Testować pełny dysk, sieć, brak zależności, podpis, clock skew, równoległy updater,
split-brain, reconnect, utratę huba i ARM64/AMD64.

<!-- docs:section risks -->
## Ryzyka i odpowiedzialność

Owner: Taskand. Nieodwracalna migracja wyklucza prosty rollback.
Odrzucony update nie oznacza shutdown; decydują polityka i ważne uprawnienia.
Offline nie odnawia grantów. Nie obiecywać zero-downtime pojedynczego węzła.
Nie usuwać lokalnego forka ani artefaktów; zachować poprzedni dozwolony zestaw.
