---
{
  "schema": "wellmanifest.docs/document/v2",
  "id": "runtime-package-contract",
  "kind": "refactoring-plan",
  "version": 1,
  "title": "Kontrakt pakietu i wydania wielojęzycznego (E-02)",
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

# Kontrakt pakietu i wydania wielojęzycznego (E-02)

<!-- docs:section summary -->
## Cel i stan

Umożliwić wersjonowane pakiety MJS/Python bez zależności od checkoutu Taskand.
Plan E-02 wymaga F-05; istniejący płaski checker MJS nie stanowi obsługi Python.

<!-- docs:section details -->
## Zakres i rozwiązanie

Rozróżniać proces URI (operacja/kontrakt), pakiet (owner/version/digest),
artefakt (bajty/platforma), źródło (repo/commit/path), release (zgodny zestaw),
instancję (osobna tożsamość), twin (model/provenance/wierność) i zadanie
(trwałe ID/URN z wersjami wykonania). URN nie daje uprawnień.
API major, semver, rewizja modelu i digest nie są zamienne.

Manifest deklaruje ID, wersję, procesy, I/O, błędy/stany/typy/zmienne,
runner/entrypoint, platformy, zasoby, uprawnienia, zależności, testy, licencję,
provenance i migracje. Rejestry referencjonować; nowe rekordy rejestrować.

MJS: package.json, exports/bin, engines, lista plików i tarball.
Python: pyproject.toml, backend, entrypoints, wheel/sdist. Inne języki mają
własne formaty. README opisuje kontrakt, efekty, błędy i przykład.
Import biblioteki nie czyta stdin ani nie uruchamia telemetrii.
OCI zależy od profilu; Dockerfile nie jest gotową paczką.

Pilot generated/hw rozdziela bibliotekę, CLI i URI. Deklaruje sensors, df,
/sys, GPIO oraz host/container. Brak czujnika to UNKNOWN/null. Używa fixtures
i jawnych mountów read-only; bez privileged ani całego hosta.
AMD64/ARM64 potrzebują właściwych artefaktów. Osobne repo uzasadniają
niezależny owner, cykl wydań i drugi konsument.

<!-- docs:section validation -->
## Weryfikacja

Nowy kontrakt registry i zgodny checker poprzedzają zmianę pakowania.
Odbiór: dwa konsumery, czysta instalacja MJS/Python, dependency closure/lock,
SBOM/provenance i brak sekretów. Testować unknown fields/types, NaN/overflow,
brak URN, konflikt wersji, cykl, runner/ABI; V-18–V-20, V-46, V-51.

<!-- docs:section risks -->
## Ryzyka i odpowiedzialność

Owner: Taskand, wellmanifest/dsl i właściciel registry. README/Dockerfile
zmienia hash: nie nadpisywać immutable wersji. Efekty nadal przechodzą
przez URI/broker. Emulacja nie dowodzi działania czujników.
Rollback wybiera poprzedni zgodny manifest.
