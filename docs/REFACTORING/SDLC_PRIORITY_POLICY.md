---
{
  "schema": "wellmanifest.docs/document/v2",
  "id": "sdlc-priority-policy",
  "kind": "refactoring-plan",
  "version": 1,
  "title": "Priorytety pracy i pilne zdarzenia (E-08)",
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

# Priorytety pracy i pilne zdarzenia (E-08)

<!-- docs:section summary -->
## Cel i stan

Odwzorować URGENT → BUGFIX → FEATURE → SERVICE bez zagłodzenia utrzymania.
Ranking nie nadaje uprawnień do wykonania.

<!-- docs:section details -->
## Zakres i rozwiązanie

W intent/v3 BUGFIX mapuje na BUG; P0–P3 jest oddzielne od rodzaju.
URGENT to potwierdzony incydent/severity i ewentualne preemption, zwykle BUG/P0,
nie nowy enum ani polecenie shutdown.

wellmanifest/priority ma warstwy lexicographic, sygnały, starzenie, starvation
i ranking związany digestem. Potrzebny jawny profil SDLC i projekcje
Taskand/Planfile/CLI/web. Kind-before-priority nie implementuje przerwania
ani rezerwacji utrzymania.

Określić mierzoną pojemność/cadence preventive SERVICE/BUGFIX i maksymalny
wiek kolejki. Wyższa waga SERVICE nie omija stale wyższej warstwy.
Zależności mogą wymagać SERVICE przed FEATURE; decyzja wyjaśnia wpływ
na opóźnione prace. Bez uniwersalnych procentów i niespójnych enumów.

URGENT: potwierdzić ryzyko, ograniczyć efekt, odizolować zdolność/wycofać grant,
zachować dowód i uruchomić ograniczoną naprawę. Shutdown usługi/hosta/floty
jest osobną decyzją zależną od szkody i authority. Po incydencie reproducer,
analiza przyczyny i profilaktyczny SERVICE.

<!-- docs:section validation -->
## Weryfikacja

E-08 wymaga F-10/E-06; V-40–V-41. Testować incydent podczas efektu, stale readings,
napływ FEATURE, starzejący SERVICE, zależności/cykl, freeze PR i brak zgody
na shutdown. Incydent nie czeka za zwykłą pracą; SERVICE ma ograniczone
oczekiwanie; przerwanie nie uszkadza efektu.

<!-- docs:section risks -->
## Ryzyka i odpowiedzialność

Owner: wellmanifest/priority i new-project; Taskand dostarcza projekcje.
Ranking jest propose-only; bez ręcznego przepisywania zarządzanej adopcji.
Rollback przywraca profil, zachowując dziennik decyzji, zadania
i rozliczenie rozpoczętych efektów.
