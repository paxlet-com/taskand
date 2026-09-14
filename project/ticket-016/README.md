# Ticket 016: Portable opt-in gateway container profile

- **ID**: ticket-016
- **Owner**: unresolved:human
- **Status**: IN_PROGRESS
- **Workflow state**: PUBLICATION
- **Created**: 2026-09-14

## Goal and scope

SESSION_EXECUTION_AUTHORIZATION: user requested implementation of Docker and
virtualization improvements and continued execution on 2026-09-14. Add an opt-in
portable gateway image/profile without modifying or deploying the existing stack.
Publish only through protected OneDev and independent Validator delivery.

## Acceptance criteria

- [x] AC-01: The continuation authorizes this bounded implementation.
- [x] AC-02: The profile has no host network, privileged mode or Docker socket;
  runs non-root with a read-only root and explicitly persistent context storage.
- [x] AC-03: Runtime starts without package installation; private grants are
  mounted read-only and neither secrets nor host state are baked into the image.
- [x] AC-04: Focused regression tests and managed governance pass. Document
  untested platforms, build reproducibility limits and unsupported capabilities.
- [ ] AC-05: Protected exact-head publication completes separately from deployment.

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
