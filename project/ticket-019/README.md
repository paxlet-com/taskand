# Ticket 019: Publish the durable LLM development optimization plan

- **ID**: ticket-019
- **Owner**: codex
- **Status**: IN_PROGRESS
- **Workflow state**: EDIT
- **Created**: 2026-09-15

## Goal and scope

Move the session's durable LLM/ecosystem optimization plan from its private
handoff store into the Taskand repository and index it through the canonical
documentation tree. Keep raw logs, receipts and recovery snapshots private.
The existing wellmanifest/docs and wellmanifest/report contracts remain the
owners of placement semantics; adoption is handled by the dedicated governance
ticket and this ticket does not create a competing standard.

## Acceptance criteria

- [x] AC-01: The plan exists at `docs/refactoring/llm-development-optimization-plan.md` with document/v1 metadata and every required refactoring-plan section marker.
- [x] AC-02: `docs/README.md` links the canonical plan under `docs/refactoring`.
- [x] AC-03: The private source copy remains available, while the repository copy is the durable result and does not embed raw logs, credentials or private transcripts.
- [ ] AC-04: Managed governance and documentation checks pass on this exact ticket diff; Docs policy adoption and external protected publication remain separate lifecycle states.

## Validation evidence

- Source copy: `private-recovery://taskand-ext-handoff-20260915/LLM_DEVELOPMENT_OPTIMIZATION_PLAN.md` (private recovery artifact; not a delivery location).
- The immutable Docs source revision and policy digest are recorded for the dedicated governance adoption ticket, not asserted as adopted by this documentation-only ticket.
- The plan records session observations, not a claim that all referenced implementations, packages or deployments are complete.

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output. The ticket remains
IN_PROGRESS through exact-head review and protected publication; the plan
itself grants no merge, deployment or secret authority.
