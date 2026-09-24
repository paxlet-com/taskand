# Ticket 050: Autonomous cluster background gossip and continuous registry sync

- **ID**: ticket-050
- **Owner**: antigravity
- **Status**: IN_PROGRESS
- **Workflow state**: PUBLICATION
- **Created**: 2026-09-24

## Goal and scope

Implement an autonomous background gossip engine and continuous synchronization service for Taskand cluster nodes. The service runs in the background within the gateway process, continuously monitoring configured peers, exchanging catalog state, autonomously pulling missing packages, and approving them for immediate availability without requiring external operator triggers.

## Acceptance criteria

- [x] AC-01: Background gossip service engine implemented (`gateway/gossip.py`).
- [x] AC-02: HTTP API endpoints `/api/cluster/gossip` (GET status, POST trigger) implemented (`gateway/handlers/gossip.py`, `gateway/router.py`).
- [x] AC-03: Gateway starts and stops the background gossip worker when enabled (`gateway/__init__.py`).
- [x] AC-04: CLI command `taskand gossip [status|sync]` added (`bin/taskand`).
- [x] AC-05: Unit test suite validating discovery, pull, auto-approval, and handlers (`tests/gossip_test.py`).

## Tracking boundary

This directory contains the minimal reviewed intent. Optional participant prose
and raw command logs are not required delivery output.
