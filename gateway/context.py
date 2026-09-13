"""Private, owner-scoped context and factual request events (SQLite, stdlib only).

URNs identify immutable revisions. HTTP URIs locate them. A declared twin is
not a verified simulation, and a returned response is not a successful task.
"""
import contextvars
import hashlib
import hmac
import json
import os
import re
import sqlite3
import time
import uuid
from functools import lru_cache
from contextlib import contextmanager
from pathlib import Path

ACTIVE = contextvars.ContextVar('taskand_request', default=None)
URN = re.compile(r'^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
EVENT_URN = re.compile(r'^urn:taskand:request-event:([0-9a-f-]{36}):([1-9][0-9]*)$')
SECRET = re.compile(r'(?i)(authorization|cookie|password|passwd|secret|api[_-]?key|access[_-]?token|hasło|haslo)')


class ContextError(ValueError):
    pass


def packed(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def redact(text):
    text = re.sub(r'(?i)(bearer\s+)[A-Za-z0-9._~+/=-]+', r'\1[REDACTED]', text)
    text = re.sub(r'(?i)((?:password|passwd|secret|api[_-]?key|token|hasło|haslo)\s*[=:]\s*)[^\s,;]+', r'\1[REDACTED]', text)
    text = re.sub(r'\b(?:gh[pousr]_[A-Za-z0-9_]{12,}|sk-[A-Za-z0-9_-]{12,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b', '[REDACTED]', text)
    return text


def prompts(value, path='$', depth=0):
    if depth > 24:
        raise ContextError('CONTEXT_INPUT_DEPTH')
    result = []
    if isinstance(value, dict):
        for key, item in value.items():
            if key.startswith('_') or SECRET.search(key):
                continue
            if key in {'message', 'prompt', 'task', 'goal'} and isinstance(item, str):
                result.append({'path': path + '.' + key, 'text': item})
            elif isinstance(item, (dict, list)):
                result.extend(prompts(item, path + '.' + key, depth + 1))
    elif isinstance(value, list):
        for index, item in enumerate(value):
            result.extend(prompts(item, f'{path}[{index}]', depth + 1))
    return result


class Store:
    def __init__(self, root):
        self.root = Path(root).absolute()
        if any(p.is_symlink() for p in (self.root, *self.root.parents)):
            raise ContextError('CONTEXT_SYMLINK_FORBIDDEN')
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        os.chmod(self.root, 0o700)
        self.path = self.root / 'context.sqlite3'
        if self.path.is_symlink():
            raise ContextError('CONTEXT_SYMLINK_FORBIDDEN')
        fd = os.open(self.path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        os.close(fd)
        os.chmod(self.path, 0o600)
        with self.connect() as db:
            db.executescript('''
                CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY,value BLOB NOT NULL);
                CREATE TABLE IF NOT EXISTS objects (urn TEXT PRIMARY KEY,owner TEXT NOT NULL,
                  kind TEXT NOT NULL,family TEXT NOT NULL,revision INTEGER NOT NULL,
                  parent TEXT,payload TEXT NOT NULL,refs TEXT NOT NULL,digest TEXT NOT NULL,
                  created REAL NOT NULL,UNIQUE(owner,family,revision));
                CREATE TABLE IF NOT EXISTS requests (id TEXT PRIMARY KEY,owner TEXT NOT NULL,
                  prompt TEXT NOT NULL,path TEXT NOT NULL,state TEXT NOT NULL,retain INTEGER NOT NULL,
                  created REAL NOT NULL,updated REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY AUTOINCREMENT,
                  request TEXT NOT NULL,node TEXT NOT NULL,stage TEXT NOT NULL,uri TEXT,
                  at REAL NOT NULL,FOREIGN KEY(request) REFERENCES requests(id));
            ''')
            db.execute('INSERT OR IGNORE INTO meta VALUES (?,?)', ('audit-key', os.urandom(32)))

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=20)
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA foreign_keys=ON')
        db.execute('PRAGMA synchronous=FULL')
        try:
            yield db
            db.commit()
        except BaseException:
            db.rollback()
            raise
        finally:
            db.close()

    def get(self, owner, urn, db=None):
        event = EVENT_URN.fullmatch(urn) if isinstance(urn, str) else None
        if event:
            if db is None:
                with self.connect() as connection:
                    return self.get(owner, urn, connection)
            row = db.execute('SELECT e.*,r.prompt FROM events e JOIN requests r ON r.id=e.request WHERE r.owner=? AND e.request=? AND e.seq=?',
                             (owner, 'urn:uuid:' + event[1], int(event[2]))).fetchone()
            if row is None:
                raise ContextError('CONTEXT_REFERENCE_NOT_FOUND')
            payload = dict(row)
            return {'schema': 'taskand.request-event/v1', 'kind': 'event', 'urn': urn, 'owner': owner,
                    'payload': payload, 'refs': [row['prompt']], 'digest': hashlib.sha256(packed(payload).encode()).hexdigest(),
                    'uri': '/api/context?urn=' + urn}
        if not isinstance(urn, str) or not URN.fullmatch(urn):
            raise ContextError('CONTEXT_REFERENCE_INVALID')
        if db is None:
            with self.connect() as connection:
                return self.get(owner, urn, connection)
        row = db.execute('SELECT * FROM objects WHERE owner=? AND urn=?', (owner, urn)).fetchone()
        if row is None:
            raise ContextError('CONTEXT_REFERENCE_NOT_FOUND')
        result = dict(row)
        result['payload'], result['refs'] = json.loads(row['payload']), json.loads(row['refs'])
        identity = {k: result[k] for k in ('urn', 'owner', 'kind', 'family', 'revision', 'parent', 'payload', 'refs')}
        if hashlib.sha256(packed(identity).encode()).hexdigest() != row['digest']:
            raise ContextError('CONTEXT_OBJECT_DIGEST_MISMATCH')
        result['uri'] = '/api/context?urn=' + urn
        result['schema'] = 'taskand.context-object/v1'
        return result

    def _put(self, db, owner, kind, payload, refs=(), parent=None):
        if not isinstance(refs, (list, tuple)) or len(refs) > 64 or len(set(refs)) != len(refs):
            raise ContextError('CONTEXT_REFERENCES_INVALID')
        for ref in refs:
            self.get(owner, ref, db)
        prior = self.get(owner, parent, db) if parent else None
        if prior and prior['kind'] != kind:
            raise ContextError('CONTEXT_REVISION_KIND_MISMATCH')
        urn = 'urn:uuid:' + str(uuid.uuid4())
        family, revision = (prior['family'], prior['revision'] + 1) if prior else (urn, 1)
        if prior and db.execute('SELECT MAX(revision) FROM objects WHERE owner=? AND family=?', (owner, family)).fetchone()[0] != prior['revision']:
            raise ContextError('CONTEXT_STALE_REVISION')
        text = packed(payload)
        if len(text.encode()) > 65536:
            raise ContextError('CONTEXT_OBJECT_TOO_LARGE')
        identity = {'urn': urn, 'owner': owner, 'kind': kind, 'family': family, 'revision': revision,
                    'parent': parent, 'payload': payload, 'refs': list(refs)}
        db.execute('INSERT INTO objects VALUES (?,?,?,?,?,?,?,?,?,?)',
                   (urn, owner, kind, family, revision, parent, text, packed(list(refs)), hashlib.sha256(packed(identity).encode()).hexdigest(), time.time()))
        return self.get(owner, urn, db)

    def profile(self, owner, payload, refs=(), parent=None):
        if not isinstance(payload, dict) or set(payload) != {'label', 'prompts', 'synthetic'} or payload['synthetic'] is not True:
            raise ContextError('USER_TWIN_EXPLICIT_SYNTHETIC_PROFILE_REQUIRED')
        if not isinstance(payload['label'], str) or not 1 <= len(payload['label']) <= 100 or redact(payload['label']) != payload['label']:
            raise ContextError('USER_TWIN_LABEL_INVALID')
        items = payload['prompts']
        if not isinstance(items, list) or not 1 <= len(items) <= 20:
            raise ContextError('USER_TWIN_PROMPTS_INVALID')
        if any(not isinstance(p, str) or not 1 <= len(p) <= 4000 or redact(p) != p for p in items):
            raise ContextError('USER_TWIN_UNSAFE_OR_INVALID_FIXTURE')
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            for ref in refs:
                if self.get(owner, ref, db)['kind'] != 'user_twin':
                    raise ContextError('USER_TWIN_COMPONENT_TYPE')
            return self._put(db, owner, 'user_twin', payload, refs, parent)

    def list(self, owner, kind='user_twin'):
        if kind not in {'user_twin', 'prompt', 'answer', 'observer_plan', 'observer_receipt'}:
            raise ContextError('CONTEXT_KIND_INVALID')
        with self.connect() as db:
            rows = db.execute('SELECT urn FROM objects WHERE owner=? AND kind=? ORDER BY created DESC LIMIT 100', (owner, kind))
            return [self.get(owner, row['urn'], db) for row in rows]

    def begin(self, owner, path, body, request_id=None, retain=False, refs=()):
        rid = request_id or 'urn:uuid:' + str(uuid.uuid4())
        if not isinstance(rid, str) or not URN.fullmatch(rid):
            raise ContextError('CONTEXT_REQUEST_ID_INVALID')
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            key = db.execute('SELECT value FROM meta WHERE key=?', ('audit-key',)).fetchone()[0]
            source = prompts(body)
            payload = {'source': path, 'retention': 'redacted-opt-in' if retain else 'metadata-only',
                       'inputDigest': 'hmac-sha256:' + hmac.new(key, packed(body).encode(), hashlib.sha256).hexdigest(),
                       'parts': [{'path': p['path'], 'characters': len(p['text']),
                                  'text': redact(p['text']) if retain else None} for p in source]}
            obj = self._put(db, owner, 'prompt', payload, refs)
            try:
                db.execute('INSERT INTO requests VALUES (?,?,?,?,?,?,?,?)', (rid, owner, obj['urn'], path, 'RECEIVED', int(retain), time.time(), time.time()))
            except sqlite3.IntegrityError as error:
                raise ContextError('CONTEXT_REQUEST_ID_ALREADY_USED') from error
            db.execute('INSERT INTO events(request,node,stage,at) VALUES (?,?,?,?)', (rid, obj['urn'], 'RECEIVED', time.time()))
            return {'requestId': rid, 'promptRef': obj['urn'], 'owner': owner, 'store': self}

    def event(self, owner, request, node, stage, uri=None):
        if stage not in {'CALLING', 'RETURNED', 'FAILED', 'RESPONDED'}:
            raise ContextError('CONTEXT_EVENT_STAGE_INVALID')
        with self.connect() as db:
            if not db.execute('SELECT 1 FROM requests WHERE owner=? AND id=?', (owner, request)).fetchone():
                raise ContextError('CONTEXT_REQUEST_NOT_FOUND')
            db.execute('INSERT INTO events(request,node,stage,uri,at) VALUES (?,?,?,?,?)', (request, node, stage, uri, time.time()))
            db.execute('UPDATE requests SET updated=? WHERE id=?', (time.time(), request))

    def finish(self, owner, request, result, code=200):
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT * FROM requests WHERE owner=? AND id=?', (owner, request)).fetchone()
            if not row:
                raise ContextError('CONTEXT_REQUEST_NOT_FOUND')
            if row['state'] in {'RESPONDED', 'FAILED'}:
                raise ContextError('CONTEXT_REQUEST_ALREADY_FINISHED')
            failed = code >= 400 or result.get('ok') is False
            state = 'FAILED' if failed else 'RESPONDED'
            payload = {'status': state, 'httpStatus': code, 'taskSuccessVerified': False,
                       'text': redact(str(result.get('reply', '')))[:16000] if row['retain'] else None}
            answer = self._put(db, owner, 'answer', payload, [row['prompt']])
            db.execute('UPDATE requests SET state=?,updated=? WHERE id=?', (state, time.time(), request))
            db.execute('INSERT INTO events(request,node,stage,at) VALUES (?,?,?,?)', (request, answer['urn'], state, time.time()))
            return {'requestId': request, 'promptRef': row['prompt'], 'answerRef': answer['urn']}

    def graph(self, owner, request):
        with self.connect() as db:
            row = db.execute('SELECT * FROM requests WHERE owner=? AND id=?', (owner, request)).fetchone()
            if not row:
                raise ContextError('CONTEXT_REQUEST_NOT_FOUND')
            events = [dict(e) for e in db.execute('SELECT * FROM events WHERE request=? ORDER BY seq', (request,))]
            for event in events:
                event['urn'] = 'urn:taskand:request-event:' + request.removeprefix('urn:uuid:') + ':' + str(event['seq'])
                event['uriRef'] = '/api/context?urn=' + event['urn']
            nodes = {}
            for e in events:
                nodes[e['node']] = {'id': e['node'], 'state': e['stage'], 'uri': e['uri'], 'at': e['at']}
            ids = list(nodes)
            return {'schema': 'taskand.request-graph/v1', 'requestId': request, 'state': row['state'], 'nodes': list(nodes.values()),
                    'edges': [{'from': a, 'to': b, 'relation': 'observed-next'} for a, b in zip(ids, ids[1:])],
                    'events': events, 'coverage': 'gateway-boundaries-only', 'taskSuccessVerified': False}


@lru_cache(maxsize=1)
def default_store():
    base = Path('/taskand') if Path('/taskand/generated').exists() else Path(__file__).resolve().parent.parent
    return Store(base / 'log/context')


def main():
    """CLI intake: principal is the OS user, never a caller-supplied identity."""
    import sys
    payload = json.load(sys.stdin)
    owner = 'local-uid:' + str(os.getuid())
    store = default_store()
    if payload['action'] == 'begin':
        result = store.begin(owner, 'cli/registry', payload['input'])
        result.pop('store'); result.pop('owner')
    elif payload['action'] == 'finish':
        result = store.finish(owner, payload['requestId'], payload['result'])
    else:
        raise ContextError('CONTEXT_CLI_ACTION_INVALID')
    print(packed(result))


if __name__ == '__main__':
    main()
