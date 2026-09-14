#!/usr/bin/env python3
"""Operator-only context recovery; never starts a container or overwrites data."""
import argparse
from contextlib import closing
import hashlib
import io
import json
import os
from pathlib import Path
import re
import selectors
import signal
import sqlite3
import stat
import subprocess
import tarfile
import tempfile
import time

MAX_DATABASE = 64 * 1024 * 1024
COMMAND_SECONDS = 30
HEX = re.compile(r'[0-9a-f]{64}')
CONTEXT_COLUMNS = {
    'meta': {'key', 'value'},
    'objects': {'urn', 'owner', 'kind', 'family', 'revision', 'parent', 'payload', 'refs', 'digest', 'created'},
    'requests': {'id', 'owner', 'prompt', 'path', 'state', 'retain', 'created', 'updated'},
    'events': {'seq', 'request', 'node', 'stage', 'uri', 'at'},
}


class RecoveryError(ValueError):
    pass


def safe_path(value):
    path = Path(value).absolute()
    if '..' in path.parts or any(p.is_symlink() for p in (path, *path.parents)):
        raise RecoveryError('UNSAFE_PATH')
    return path


def new_target(value):
    path = safe_path(value)
    if path.exists():
        raise RecoveryError('DESTINATION_EXISTS')
    parent = path.parent.stat()
    if not stat.S_ISDIR(parent.st_mode) or parent.st_uid != os.geteuid() or parent.st_mode & 0o022:
        raise RecoveryError('PRIVATE_OWNED_PARENT_REQUIRED')
    return path


def capture(command, limit, timeout=COMMAND_SECONDS):
    """Bound stdout, elapsed time and cleanup; never expose raw Docker stderr."""
    deadline = time.monotonic() + timeout
    with subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                          stdin=subprocess.DEVNULL, start_new_session=True) as child:
        try:
            result = bytearray()
            with selectors.DefaultSelector() as selector:
                selector.register(child.stdout, selectors.EVENT_READ)
                while True:
                    remaining = deadline - time.monotonic()
                    if remaining <= 0 or not selector.select(remaining):
                        raise RecoveryError('COPY_DEADLINE_EXCEEDED')
                    chunk = os.read(child.stdout.fileno(), min(65536, limit - len(result) + 1))
                    if not chunk:
                        break
                    result.extend(chunk)
                    if len(result) > limit:
                        raise RecoveryError('COPY_SIZE_EXCEEDED')
            if child.wait(timeout=max(0.001, deadline - time.monotonic())) != 0:
                raise RecoveryError('COPY_COMMAND_FAILED')
            return bytes(result)
        except subprocess.TimeoutExpired as error:
            raise RecoveryError('COPY_DEADLINE_EXCEEDED') from error
        finally:
            # Descendants can hold stdout after the parent exits. Reap the whole
            # private group, not only a still-running command process.
            try:
                os.killpg(child.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            child.wait(timeout=2)


def stopped_container(identity):
    if not HEX.fullmatch(identity):
        raise RecoveryError('EXACT_CONTAINER_ID_REQUIRED')
    template = ('{"id":{{json .Id}},"name":{{json .Name}},"image":{{json .Image}},'
                '"status":{{json .State.Status}},"started":{{json .State.StartedAt}},'
                '"finished":{{json .State.FinishedAt}}}')
    value = json.loads(capture(['docker', 'inspect', '--type=container', '--format', template, identity], 16384))
    if (value.get('id') != identity or value.get('status') != 'exited'
            or not re.fullmatch(r'/glm53-gateway-[a-z0-9-]+', value.get('name', ''))
            or not re.fullmatch(r'sha256:[0-9a-f]{64}', value.get('image', ''))):
        raise RecoveryError('STOPPED_GATEWAY_REQUIRED')
    return value


def database_from_tar(raw):
    """A clean DELETE-journal Store only; sidecars require a different recovery plan."""
    if len(raw) > MAX_DATABASE + 1024 * 1024:
        raise RecoveryError('COPY_SIZE_EXCEEDED')
    content, seen = None, set()
    try:
        with tarfile.open(fileobj=io.BytesIO(raw), mode='r:') as archive:
            for member in archive:
                if member.name in seen or len(seen) >= 2:
                    raise RecoveryError('UNEXPECTED_CONTEXT_INVENTORY')
                seen.add(member.name)
                if member.name == 'context' and member.isdir():
                    continue
                if (member.name != 'context/context.sqlite3' or not member.isfile()
                        or member.issparse() or not 100 <= member.size <= MAX_DATABASE):
                    raise RecoveryError('UNEXPECTED_CONTEXT_INVENTORY')
                with archive.extractfile(member) as stream:
                    content = stream.read(MAX_DATABASE + 1)
                if len(content) != member.size:
                    raise RecoveryError('TRUNCATED_DATABASE')
    except tarfile.TarError as error:
        raise RecoveryError('INVALID_CONTEXT_ARCHIVE') from error
    if content is None:
        raise RecoveryError('DATABASE_MISSING')
    return content


def validate_database(path):
    deadline = time.monotonic() + 5
    try:
        with closing(sqlite3.connect(path.as_uri() + '?mode=ro&immutable=1', uri=True)) as database:
            database.set_progress_handler(lambda: int(time.monotonic() > deadline), 1000)
            if database.execute('PRAGMA quick_check(1)').fetchone() != ('ok',):
                raise RecoveryError('DATABASE_INTEGRITY_FAILED')
            tables = {row[0] for row in database.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            if tables - {'sqlite_sequence'} != set(CONTEXT_COLUMNS):
                raise RecoveryError('CONTEXT_SCHEMA_UNSUPPORTED')
            for table, expected in CONTEXT_COLUMNS.items():
                columns = {row[1] for row in database.execute(f'PRAGMA table_info({table})')}
                if columns != expected:
                    raise RecoveryError('CONTEXT_SCHEMA_UNSUPPORTED')
            if database.execute("SELECT length(value) FROM meta WHERE key='audit-key'").fetchall() != [(32,)]:
                raise RecoveryError('CONTEXT_INTEGRITY_KEY_INVALID')
    except sqlite3.Error as error:
        raise RecoveryError('DATABASE_INTEGRITY_FAILED') from error


def checked_file(directory, content):
    path = Path(directory) / 'context.sqlite3'
    with path.open('xb') as stream:
        os.chmod(path, 0o600)
        stream.write(content)
        stream.flush()
        os.fsync(stream.fileno())
    validate_database(path)
    return path


def sync_directory(path):
    descriptor = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def snapshot(identity, destination, acknowledge=False):
    if not acknowledge:
        raise RecoveryError('SENSITIVE_DATA_ACKNOWLEDGEMENT_REQUIRED')
    destination = new_target(destination)
    before = stopped_container(identity)
    raw = capture(['docker', 'cp', identity + ':/taskand/log/context', '-'], MAX_DATABASE + 1024 * 1024)
    if stopped_container(identity) != before:
        raise RecoveryError('CONTAINER_CHANGED_DURING_COPY')
    content = database_from_tar(raw)
    with tempfile.TemporaryDirectory(prefix='.context-snapshot-', dir=destination.parent) as directory:
        path = checked_file(directory, content)
        # Same-filesystem link is atomic and fails even if an empty target appeared.
        os.link(path, destination, follow_symlinks=False)
        sync_directory(destination.parent)
    return {'operation': 'snapshot', 'status': 'VERIFIED', 'containerId': identity,
            'image': before['image'], 'sha256': hashlib.sha256(content).hexdigest(),
            'bytes': len(content), 'sensitive': True, 'activated': False}


def restore(source, expected_sha256, destination, acknowledge=False):
    if not acknowledge:
        raise RecoveryError('SENSITIVE_DATA_ACKNOWLEDGEMENT_REQUIRED')
    if not HEX.fullmatch(expected_sha256):
        raise RecoveryError('EXACT_SNAPSHOT_DIGEST_REQUIRED')
    source, destination = safe_path(source), new_target(destination)
    fd = os.open(source, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, 'rb') as stream:
        info = os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or not 100 <= info.st_size <= MAX_DATABASE:
            raise RecoveryError('SNAPSHOT_SIZE_OR_TYPE_INVALID')
        content = stream.read(MAX_DATABASE + 1)
    if len(content) > MAX_DATABASE or hashlib.sha256(content).hexdigest() != expected_sha256:
        raise RecoveryError('SNAPSHOT_DIGEST_MISMATCH')
    with tempfile.TemporaryDirectory(prefix='.context-restore-', dir=destination.parent) as directory:
        path = checked_file(directory, content)
        destination.mkdir(mode=0o700)  # Exclusive reservation; never reuse existing data.
        try:
            os.link(path, destination / 'context.sqlite3', follow_symlinks=False)
        except BaseException:
            destination.rmdir()  # Only our empty reservation; preserve any unexpected contents.
            raise
        sync_directory(destination)
        sync_directory(destination.parent)
    return {'operation': 'restore', 'status': 'PREPARED', 'sha256': expected_sha256,
            'bytes': len(content), 'sensitive': True, 'activated': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['snapshot', 'restore'])
    parser.add_argument('--container-id')
    parser.add_argument('--source', type=Path)
    parser.add_argument('--sha256')
    parser.add_argument('--destination', type=Path, required=True)
    parser.add_argument('--acknowledge-sensitive-data', action='store_true')
    args = parser.parse_args()
    if args.action == 'snapshot' and (not args.container_id or args.source or args.sha256):
        parser.error('snapshot requires only --container-id and --destination')
    if args.action == 'restore' and (not args.source or not args.sha256 or args.container_id):
        parser.error('restore requires --source, --sha256 and --destination')
    try:
        if args.action == 'snapshot':
            result = snapshot(args.container_id, args.destination, args.acknowledge_sensitive_data)
        else:
            result = restore(args.source, args.sha256, args.destination, args.acknowledge_sensitive_data)
        print(json.dumps(result))
        return 0
    except (RecoveryError, OSError, ValueError, TypeError) as error:
        # Paths, data, SQL and raw Docker errors do not enter receipts.
        print(json.dumps({'status': 'FAILED', 'code': str(error) if isinstance(error, RecoveryError)
                          else 'RECOVERY_IO_OR_FORMAT_ERROR', 'activated': False}))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
