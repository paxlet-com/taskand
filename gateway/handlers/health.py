import os
import socket
import hashlib
import json
from pathlib import Path
import re

from gateway.utils import LLM_KEY, LLM_MODEL, registry

NODE = os.environ.get("TASKAND_NODE", socket.gethostname())


def release_identity(manifest_path=None, expected_digest=None, app_root=None, data_root=None):
    """Bounded local code-integrity observation, never signed release authority.

    Config, mutable data and registry packages are deliberately outside this
    gateway/UI check. No environment-provided commit is trusted on its own.
    """
    unknown = {"commit": None, "artifactSha256": None, "identityStatus": "UNREPORTED"}
    manifest_path = manifest_path or os.environ.get('TASKAND_RELEASE_MANIFEST')
    expected_digest = expected_digest or os.environ.get('TASKAND_RELEASE_SHA256')
    if not manifest_path or not expected_digest:
        return unknown
    try:
        manifest_path = Path(manifest_path)
        if not re.fullmatch('[0-9a-f]{64}', expected_digest):
            raise ValueError('invalid pin')
        if any(p.is_symlink() for p in (manifest_path, *manifest_path.parents)):
            raise ValueError('symlink')
        with manifest_path.open('rb') as stream:
            raw = stream.read(1024 * 1024 + 1)
        if len(raw) > 1024 * 1024 or hashlib.sha256(raw).hexdigest() != expected_digest:
            raise ValueError('manifest mismatch')
        value = json.loads(raw)
        commit, files = value['sourceSha'], value['files']
        if not isinstance(commit, str) or not re.fullmatch('[0-9a-f]{40}', commit):
            raise ValueError('invalid commit')
        if not isinstance(files, dict) or not 3 <= len(files) <= 4096:
            raise ValueError('invalid inventory')
        app_root = Path(app_root) if app_root else Path(__file__).resolve().parents[2]
        data_root = Path(data_root) if data_root else Path('/taskand') if app_root == Path('/app') else app_root
        code = {name: sha for name, sha in files.items() if name.startswith('gateway/')}
        if not code or len(code) > 128:
            raise ValueError('missing or oversized gateway inventory')
        actual = {'gateway/' + str(p.relative_to(app_root / 'gateway'))
                  for p in (app_root / 'gateway').rglob('*.py')}
        if actual != set(code):
            raise ValueError('gateway inventory mismatch')
        selected = {**code, 'gateway.py': files['gateway.py'], 'index.html': files['index.html']}
        for name, expected in selected.items():
            if '..' in Path(name).parts or Path(name).is_absolute() or not re.fullmatch('[0-9a-f]{64}', expected):
                raise ValueError('invalid file record')
            path = data_root / name if name == 'index.html' else app_root / name
            if name == 'gateway.py' and app_root == Path('/app'):
                path = app_root / 'server.py'
            if any(p.is_symlink() for p in (path, *path.parents)):
                raise ValueError('symlink')
            with path.open('rb') as stream:
                content = stream.read(1024 * 1024 + 1)
            if len(content) > 1024 * 1024 or hashlib.sha256(content).hexdigest() != expected:
                raise ValueError('code mismatch')
        return {'commit': commit, 'artifactSha256': expected_digest,
                'identityStatus': 'LOCAL_CODE_MATCH'}
    except (OSError, ValueError, TypeError, KeyError, RecursionError):
        return {**unknown, 'identityStatus': 'MISMATCH_OR_INVALID'}


def handle_healthz(request_handler, body: dict) -> None:
    listing = registry("list", {"status": "active"}, timeout=30)
    request_handler._send(200, {
        "ok": listing.get("ok", False),
        "node": NODE,
        "version": "3.0.0",
        "processes": listing.get("total", 0),
        "llm_configured": bool(LLM_KEY),
        "model": LLM_MODEL if LLM_KEY else None,
        **release_identity(),
    })
