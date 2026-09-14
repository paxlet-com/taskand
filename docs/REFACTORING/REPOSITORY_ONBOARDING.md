---
{
  "schema": "wellmanifest.docs/document/v2",
  "id": "repository-onboarding",
  "kind": "refactoring-plan",
  "version": 1,
  "title": "Obsługa istniejącego repozytorium (E-06)",
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

# Obsługa istniejącego repozytorium (E-06)

<!-- docs:section summary -->
## Cel i stan

Taskand wspiera projekt przez jawne przypięcie repo i profilu.
Runtime działa poza checkoutem. Etap jest propozycją i wymaga F-10/E-02.

<!-- docs:section details -->
## Zakres i rozwiązanie

Tryby: observe, propose, sandbox, authorized-execute. CLI/web pokazują ten
sam stan. Instalacja nie uruchamia hooków obcego repo ani nie zastępuje project.sh.

Inventory: primary/linked checkouts, lokalne i odczytane remote refs, ancestry,
dirty/staged/untracked, PR/checki, tickety, leases, procesy i deploymenty/mounty.
Uzgodnić intent ↔ diff ↔ branch ↔ worktree ↔ PR. Wskazać unikalne commity
i rzeczywiste nakładanie zapisów. Odróżnić konflikt treści od blokady CI,
authority, checkoutu i transportu.

Reużyć matching ticket; gotowy autoryzowany PR może usunąć zależność.
Niezależne zakresy mogą postępować równolegle; integracja jest serializowana.
Finding ma kod, dowód, ownera, prerequisites, remediację, rollback i kryterium
zamknięcia. Deduplikować zamiast mnożyć tickety.
Brak profilu oznacza onboarding, nie zgodność.
[Dostawa CI](LOCAL_CI_DELIVERY.md) wymaga uprawnienia na repo i efekt.

<!-- docs:section validation -->
## Weryfikacja

Pilot: jedno repo i mały ticket/PR, inventory read-only, dry-run uzgodnienia,
exact merge result i osobny deploy. V-02–V-06, V-38–V-39, V-52–V-53.
Fixtures: zły remote, brak standardu, wiele worktrees, unique dirty data,
nowy head/base, brak profilu/billing, złośliwe hooki i commit messages.

<!-- docs:section risks -->
## Ryzyka i odpowiedzialność

Owner: Taskand; wellmanifest/git-lifecycle, ticket-lifecycle i worktrees.
Unknown work zachować. Legacy nie uprawnia do resetu, force-push ani usunięcia.
Po integracji osobno zwalniać lease i kwalifikować dokładny checkout
do odzyskiwalnego sprzątania. Rollback odłącza adapter bez utraty pracy.
