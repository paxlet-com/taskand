# Ticket 019: Publish LLM development optimization plan and enforce report placement

- **ID**: ticket-019
- **Owner**: codex
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-09-15

## Goal and scope

Move the session's durable LLM/ecosystem optimization plan from its private
handoff store into the Taskand repository, index it through the adopted Docs
profile, and bind the repository to the immutable Docs policy. Keep raw logs,
receipts and recovery snapshots private. The existing wellmanifest/docs and
wellmanifest/report contracts remain the owners of placement semantics; this
ticket does not create a competing standard.

## Acceptance criteria

- [x] AC-01: The plan exists at `docs/refactoring/llm-development-optimization-plan.md` with document/v1 metadata and every required refactoring-plan section marker.
- [x] AC-02: `docs/README.md` links the canonical plan and `.governance/docs.json` pins the published Docs policy by full source SHA and policy digest.
- [x] AC-03: The private source copy remains available, while the repository copy is the durable result and does not embed raw logs, credentials or private transcripts.
- [ ] AC-04: Pinned Docs checker and managed governance checks pass on this exact ticket diff; external protected publication remains a separate lifecycle state.

## Validation evidence

- Source copy: `private-recovery://taskand-ext-handoff-20260915/LLM_DEVELOPMENT_OPTIMIZATION_PLAN.md` (private recovery artifact; not a delivery location).
- Published Docs source revision: `ebe7501063ef4f3e63ded610c2d3183010ca636e`, policy SHA-256: `f6ba9c011ea1d9260e7fac3a1638a767d5ebc9f7d9b32ed51cc3aea22fe95d8c`.
- The plan records session observations, not a claim that all referenced implementations, packages or deployments are complete.

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output. The ticket remains
IN_PROGRESS through exact-head review and protected publication; the plan
itself grants no merge, deployment or secret authority.
