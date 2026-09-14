---
{
  "schema": "wellmanifest.docs/document/v2",
  "id": "history-intent-analysis",
  "kind": "refactoring-plan",
  "version": 1,
  "title": "Hipotezy intencji z historii (E-07)",
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

# Hipotezy intencji z historii (E-07)

<!-- docs:section summary -->
## Cel i stan

Powiązać obserwacje Git/AST/testów/ticketów z odtwarzalnym dowodem regresji.
Historia jest materiałem analizy; wynik LLM pozostaje propozycją.

<!-- docs:section details -->
## Zakres i rozwiązanie

Obserwacje z SHA → data2dsl porównuje fakty → todo2code wiąże hipotezę →
test/dowód → propozycja naprawy. Najpierw probe API, pin i fixture.
README/nazwa nie dowodzą zgodnej integracji. Historyczny plan nie wykonywał
E2E adapterów; odróżnić planned od implemented.

Używać merge-base, zmian semantycznych i wpływu na zależności.
Zamierzony revert nie jest regresją. Polecenie użytkownika, kontrakt i kryteria
mają pierwszeństwo przed commit message. Nie wykonywać instrukcji z historii/logów.

Finding: kod, subject/version, evidence, fingerprint, first/lastSeen, occurrence
count, confidence i kryterium. Powtórzenie aktualizuje sprawę. Indeks przyrostowy
używa digestów, provenance i retencji. Nieznany format trafia do kwarantanny
parsera z jawną luką, nie do automatycznej naprawy. Adaptery mają ograniczone I/O;
bez kopiowania całych sąsiednich projektów.

<!-- docs:section validation -->
## Weryfikacja

E-07 wymaga E-06/F-05; V-42–V-44. Fixtures: celowa zmiana API, zamierzony revert,
regresja poprawności/wydajności, fałszywy alarm, nawrót, brak dowodu i nieznany
format. Test odróżnia zamiar od regresji; treść Git nie steruje agentem.
Brak danych nie jest zerem.

<!-- docs:section risks -->
## Ryzyka i odpowiedzialność

Owner: Taskand; autogrammar/data2dsl i todo2code mają własne adaptery.
Ryzyka: prompt injection, prywatne dane, dependency confusion i fałszywa pewność.
Wyłączyć niesprawdzony adapter, zachowując źródła/receipts.
Najpierw fixture/twin, potem ograniczony pilot.
