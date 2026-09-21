"""Context commands and read-only owner-filtered projections. No impersonation."""
from urllib.parse import parse_qs, urlsplit
from gateway.auth import check_auth, check_grant, require_grant
from gateway.context import ACTIVE, ContextError, default_store
from gateway.utils import call_process, registry, LLM_KEY

PLANNER = 'proc://taskand.dev/planner/plan/v1'
MCP_CATALOG = 'proc://taskand.dev/mcp/catalog/v1'


def handle_mcp_catalog(handler, body):
    """Authenticated metadata projection, with a read-only dashboard capability.

    This capability grants no registry/core call, admission or tool execution.
    Host profiles, commands, environment and credential references stay private.
    """
    user = require_grant(handler, MCP_CATALOG, 'read')
    if not user:
        return
    source = registry('list', {}, timeout=30)
    entries = source.get('processes') if isinstance(source, dict) else None
    if not isinstance(source, dict) or not source.get('ok') or not isinstance(entries, list) or len(entries) > 5000:
        handler._send(503, {'ok': False, 'error': 'MCP_CATALOG_UNAVAILABLE'})
        return
    tools = []
    for entry in entries:
        if not isinstance(entry, dict):
            handler._send(503, {'ok': False, 'error': 'MCP_CATALOG_INVALID'})
            return
        if entry.get('origin') != 'mcp':
            continue
        mcp = entry.get('mcp', {})
        uri, status = entry.get('uri'), entry.get('status')
        if (not isinstance(mcp, dict) or not all(isinstance(mcp.get(k), str) and mcp[k] for k in ('server', 'tool'))
                or not isinstance(uri, str) or not uri.startswith('proc://taskand.dev/mcp-')
                or status not in {'candidate', 'active', 'deprecated'}
                or not isinstance(entry.get('inputSchema'), dict)):
            handler._send(503, {'ok': False, 'error': 'MCP_CATALOG_INVALID'})
            return
        tools.append({'uri': uri, 'server': mcp['server'], 'name': mcp['tool'],
                      'description': entry.get('desc', ''), 'status': status,
                      'inputSchema': entry['inputSchema'],
                      **({'outputSchema': entry['outputSchema']} if isinstance(entry.get('outputSchema'), dict) else {}),
                      'canCall': status == 'active' and check_grant(user, uri, 'call'),
                      'canApprove': status != 'active' and check_grant(user, uri, 'admin')})
    tools.sort(key=lambda t: (t['server'], t['name'], t['uri']))
    handler._send(200, {'ok': True, 'tools': tools,
                       'counts': {'servers': len({t['server'] for t in tools}), 'tools': len(tools),
                                  'active': sum(t['status'] == 'active' for t in tools),
                                  'candidate': sum(t['status'] == 'candidate' for t in tools)},
                       'conversation': {'allowed': check_grant(user, 'proc://taskand.dev/dev/llm/v1', 'call'),
                                        'configured': bool(LLM_KEY)}})


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
