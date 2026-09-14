#!/usr/bin/env python3
"""Local Taskand lease adapter: Autonom durable locking + adopted transition policy.

This is a single-host cooperative controller, never a merge authority. Other
writers must use the same external store. The canonical lease file is a projection.
"""
import argparse
import hashlib
import importlib.util
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

# ADOPT only: the unmodified backend remains owned by subactor/autonom.
BACKEND_REVISION = '4e7f1aa4e230de22281366c34a117df6afc3de16'
BACKEND = Path(__file__).absolute().parent / 'vendor/autonom/change_lease.py'
BACKEND_SHA = '013c82127cb2d398e83479d82fd2d1008773cae08d322d391a6616427b614a37'
ALLOWED_ACTIONS = {'begin-edit', 'begin-validation', 'heartbeat', 'cancel'}


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def module(name, path, source=None):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    if source is None:
        spec.loader.exec_module(result)
    else:
        # Import loaders reread source or a .pyc; execute only checked bytes.
        exec(compile(source, str(path), 'exec'), result.__dict__)
    return result


def runtime_bytes(path, label):
    path = path.absolute()
    if any(part.is_symlink() for part in (path, *path.parents)):
        raise ValueError('LEASE_' + label + '_SYMLINK')
    try:
        return path.read_bytes()
    except OSError as error:
        raise ValueError('LEASE_' + label + '_UNAVAILABLE') from error


def runtimes(root):
    backend_source = runtime_bytes(BACKEND, 'BACKEND')
    if hashlib.sha256(backend_source).hexdigest() != BACKEND_SHA:
        raise ValueError('LEASE_BACKEND_DIGEST_MISMATCH')
    policy = root / '.governance/change_lease_check.py'
    lock = json.loads(runtime_bytes(root / '.governance/manifest.lock.json', 'POLICY_LOCK'))
    expected = lock['managedFiles']['.governance/change_lease_check.py']
    if isinstance(expected, dict):
        expected = expected.get('sha256')
    policy_source = runtime_bytes(policy, 'POLICY')
    if hashlib.sha256(policy_source).hexdigest() != expected:
        raise ValueError('LEASE_POLICY_DIGEST_MISMATCH')
    return (module('taskand_lease_backend', BACKEND, backend_source),
            module('taskand_lease_policy', policy, policy_source))


def transition(store, policy, request, intent):
    """The backend's older transition semantics are deliberately not invoked."""
    if request.get('action') not in ALLOWED_ACTIONS:
        raise ValueError('LEASE_LOCAL_ACTION_FORBIDDEN')
    request_hash = digest(request)
    with store._locked() as state:
        lease = state['leases'].get(request.get('leaseId'))
        if not lease or request.get('requestedBy') != lease['ownerActor']:
            raise ValueError('LEASE_OWNER_MISMATCH')
        if request['action'] == 'cancel' and (lease['publicationFrozen'] or lease['phase'] not in {'claimed', 'editing', 'validating'}):
            raise ValueError('LEASE_CANCEL_PHASE_FORBIDDEN')
        if lease['scopeHash'] != digest(intent['allowedPaths']) or lease['planHash'] != digest(intent):
            raise ValueError('LEASE_INTENT_CHANGED')
        if datetime.fromisoformat(lease['expiresAt'].replace('Z', '+00:00')) <= store.now():
            raise ValueError('LEASE_EXPIRED')
        prior = state['requests'].get(request['idempotencyKey'])
        if prior:
            if prior['requestHash'] != request_hash:
                raise ValueError('LEASE_IDEMPOTENCY_COLLISION')
            return {**prior['receipt'], 'outcome': 'idempotent'}, dict(lease)
        receipt, errors = policy.evaluate_transition(lease, request)
        if errors or policy.validate_receipt(receipt):
            raise ValueError(json.dumps(errors or policy.validate_receipt(receipt)))
        lease.update(phase=receipt['phaseAfter'], leaseRevision=receipt['leaseRevision'],
                     fencingToken=receipt['fencingToken'], heartbeatAt=receipt['occurredAt'],
                     eventSequence=lease['eventSequence'] + 1,
                     previousReceiptRef=receipt['receiptRef'])
        if request['action'] == 'heartbeat':
            lease['expiresAt'] = (store.now() + timedelta(seconds=store.ttl_seconds)).isoformat()
        if policy.validate_lease(lease):
            raise ValueError('LEASE_POSTCONDITION_FAILED')
        state['nextFencingToken'] = max(state['nextFencingToken'], lease['fencingToken'])
        if request['action'] == 'cancel':
            resource = store._resource(lease['repositoryRef'], lease['targetBranch'])
            if state['active'].get(resource) == lease['leaseId']:
                del state['active'][resource]
        state['requests'][request['idempotencyKey']] = {'requestHash': request_hash, 'receipt': receipt}
        return receipt, dict(lease)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--store', type=Path, required=True)
    parser.add_argument('--projection', type=Path, required=True)
    args = parser.parse_args()
    request = json.load(sys.stdin)
    backend, policy = runtimes(args.root)
    store = backend.ChangeLeaseStore(args.store, ttl_seconds=7200)
    lease = store.lease(request['leaseId'])
    intent = json.loads((args.root / 'project' / lease['ticketId'] / 'intent.json').read_text())
    layout_runtime = module('taskand_layout', args.root / '.governance/worktree_path_check.py')
    primary = layout_runtime.resolve_primary_checkout(str(args.root))
    expected = Path(primary) / '.subactor/leases' / (args.root.name + '.json')
    if args.projection.absolute() != expected or args.projection.is_symlink():
        raise ValueError('LEASE_PROJECTION_PATH_MISMATCH')
    if str(args.root.resolve()) != lease['worktreeId']:
        raise ValueError('LEASE_WORKTREE_MISMATCH')
    receipt, updated = transition(store, policy, request, intent)
    backend._atomic_json(args.projection, updated)
    backend._atomic_json(args.store / 'receipts' / (digest(receipt) + '.json'), receipt)
    print(json.dumps({'receipt': receipt, 'lease': updated}))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, OSError, RuntimeError) as error:
        print(json.dumps({'ok': False, 'error': str(error)}))
        raise SystemExit(1)
