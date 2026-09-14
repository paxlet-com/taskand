"""Context commands and read-only owner-filtered projections. No impersonation."""
from urllib.parse import parse_qs, urlsplit
from gateway.auth import check_auth, check_grant
from gateway.context import ACTIVE, ContextError, default_store
from gateway.utils import call_process

PLANNER = 'proc://taskand.dev/planner/plan/v1'


def identity(handler):
    authenticated, user = check_auth(handler.headers)
    if not authenticated:
        handler._send(401, {'ok': False, 'error': 'Unauthorized'})
        return None
    return user


def handle_state(handler, body):
    user = identity(handler)
    if not user:
        return
    query = parse_qs(urlsplit(handler.path).query)
    try:
        graph = default_store().graph(user['name'], query.get('requestId', [''])[0])
        handler._send(200, {'ok': True, 'graph': graph})
    except ContextError:
        handler._send(404, {'ok': False, 'error': 'CONTEXT_REQUEST_NOT_FOUND'})


def handle_context(handler, body):
    user = identity(handler)
    if not user:
        return
    store = default_store()
    try:
        if handler.command == 'GET':
            query = parse_qs(urlsplit(handler.path).query)
            if 'urn' in query:
                result = {'object': store.get(user['name'], query['urn'][0])}
            else:
                result = {'objects': store.list(user['name'], query.get('kind', ['user_twin'])[0])}
            handler._send(200, {'ok': True, **result})
            return
        if not check_grant(user, PLANNER, 'call'):
            handler._send(403, {'ok': False, 'error': 'Forbidden'})
            return
        action = body.get('action')
        if action == 'create_user_twin' and set(body) <= {'action', 'payload', 'refs', 'parent'}:
            obj = store.profile(user['name'], body.get('payload'), body.get('refs', []), body.get('parent'))
            handler._send(201, {'ok': True, 'object': obj, 'authority': 'test-data-only'})
        elif action == 'simulate' and set(body) == {'action', 'urn'}:
            todo, seen, fixtures = [body['urn']], set(), []
            while todo:
                urn = todo.pop()
                if urn in seen:
                    continue
                seen.add(urn)
                obj = store.get(user['name'], urn)
                if obj['kind'] != 'user_twin' or len(seen) > 32:
                    raise ContextError('USER_TWIN_COMPONENT_INVALID')
                todo.extend(obj['refs'])
                for prompt in obj['payload']['prompts']:
                    if len(fixtures) >= 100:
                        raise ContextError('USER_TWIN_FIXTURE_LIMIT')
                    plan = call_process(PLANNER, {'action': 'compile', 'task': prompt, 'contextRefs': [urn]})
                    if plan.get('status') != 'COMPILED':
                        raise ContextError('USER_TWIN_COMPILATION_FAILED')
                    fixtures.append({'userTwinRef': urn, 'dsl': plan['dsl'], 'dslDigest': plan['dslDigest']})
            handler._send(200, {'ok': True, 'status': 'COMPILED_FIXTURES', 'fixtures': fixtures,
                               'executed': False, 'productionApproved': False,
                               'coverage': 'reference-and-DSL-validation-only'})
        else:
            raise ContextError('CONTEXT_COMMAND_INVALID')
    except ContextError as error:
        handler._send(409, {'ok': False, 'error': str(error)})
