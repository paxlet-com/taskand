# Documentation pilot

SESSION_EXECUTION_AUTHORIZATION (2026-09-14): user explicitly requested
"kontynuuj, wypchnij, scal". Delivery now includes branch push, PR and the
declared independent protected merge process, never self-approval.
Rebased onto 2b160182 after confirming the upstream context-recovery change
does not overlap the documentation scope.

GOV-WORKSTREAM-003: manifest ownership excludes CHANGELOG.md from integration.
Removed the attempted changelog addition and narrowed allowedPaths; no ownership
policy was widened. A future publication entry belongs to governance.

SESSION_EXECUTION_AUTHORIZATION: user requested continuation and documentation
refactoring in several semcod repositories on 2026-09-14.

Work is confined to the accepted intent and this dedicated Worktrees v5
checkout. Source programs, active application tickets and primary checkout
changes are preserved. The local docs v2 candidate is tested as a format;
no production adoption pin or protected CI configuration is changed.

Canonical results are indexed in docs/README.md. Legacy files become link
maps; source history remains at c9fa3f47cb087122c49e70be97030ced9d88ef34.
