import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseIntent, parseBrowserAction } from '../generated/dev/chat/taskand.dev/v1/intent.mjs';

const discovery = 'generated/admin/github-projects-discovery/taskand.dev/v2/bin.mjs';
const runDiscovery = input => JSON.parse(spawnSync('node', [discovery], { input: JSON.stringify(input), encoding: 'utf8', timeout: 20000 }).stdout);
// Gateway celowo nieosiągalny: CLI wykonuje kod z tej kopii repozytorium
const cli = (...args) => spawnSync('node', ['bin/taskand', ...args], {
  encoding: 'utf8', timeout: 20000, env: { ...process.env, TASKAND_GATEWAY: 'http://127.0.0.1:9' }
});

test('intents match with and without Polish diacritics', () => {
  for (const [plain, accented, name] of [
    ['lista urzadzen w sieci', 'lista urządzeń w sieci', 'query'],
    ['sprawdz czy dziala', 'sprawdź czy działa', 'diagnose'],
    ['jaka jest temperatura procesora', 'jaka jest temperatura procesora', 'telemetry'],
    ['wdroz monitoring', 'wdroż monitoring', 'composite'],
    ['zrob skrypt do backupu', 'zrób skrypt do backupu', 'evolve-create']
  ]) {
    assert.equal(parseIntent(plain).name, name, plain);
    assert.equal(parseIntent(accented).name, name, accented);
  }
  assert.equal(parseIntent('co zrobic', 'doc').name, 'prescribe');
  assert.equal(parseIntent('co zrobić', 'doctor').name, 'prescribe');
});

test('spawn-organism capture keeps the original diacritics of the description', () => {
  const intent = parseIntent('stwórz organizm pamiec, który śledzi zużycie pamięci');
  assert.equal(intent.name, 'spawn-organism');
  assert.equal(intent.match[1], 'pamiec');
  assert.equal(intent.match[2], 'śledzi zużycie pamięci');
  assert.equal(parseIntent('stworz organizm backup zeby robil kopie').match[2], 'robil kopie');
});

test('short keywords match whole words only', () => {
  assert.equal(parseIntent('pokaż plan wdrożenia').name, 'composite');
  assert.equal(parseIntent('zbuduj projekt digitalizacji z dashboardem').name, 'composite');
  assert.equal(parseIntent('skanuj LAN').name, 'query');
  assert.equal(parseIntent('lista projektów na GitHub').name, 'query');
  assert.equal(parseIntent('pokaz repozytoria git').name, 'query');
});

test('github discovery reads origins, worktrees and depth without leaking credentials', () => {
  const root = mkdtempSync(join(tmpdir(), 'taskand-gh-'));
  const gitRepo = (dir, config, head = 'ref: refs/heads/main\n') => {
    mkdirSync(join(dir, '.git'), { recursive: true });
    writeFileSync(join(dir, '.git', 'config'), config);
    writeFileSync(join(dir, '.git', 'HEAD'), head);
  };
  try {
    gitRepo(join(root, 'acme', 'app'), '[core]\n\tbare = false\n[remote "origin"]\n\turl = https://bot:s3cret@github.com/acme/app.git\n');
    gitRepo(join(root, 'acme', 'tool'), '[remote "origin"]\n\turl = git@github.com:acme/tool.git\n', 'ab12cd34\n');
    gitRepo(join(root, 'other'), '[remote "origin"]\n\turl = https://gitlab.com/acme/other.git\n');
    gitRepo(join(root, 'a', 'b', 'c', 'deep'), '[remote "origin"]\n\turl = https://github.com/acme/deep\n');
    gitRepo(join(root, '.hidden', 'repo'), '[remote "origin"]\n\turl = https://github.com/acme/hidden\n');
    // Linked worktree: .git is a file, config lives in the common directory
    const linked = join(root, 'acme', 'app', '.git', 'worktrees', 'feature');
    mkdirSync(linked, { recursive: true });
    writeFileSync(join(linked, 'commondir'), '../..\n');
    writeFileSync(join(linked, 'HEAD'), 'ref: refs/heads/ticket/001-feature\n');
    mkdirSync(join(root, 'feature'));
    writeFileSync(join(root, 'feature', '.git'), `gitdir: ${linked}\n`);

    const out = runDiscovery({ searchRoots: [root, join(root, 'missing')], maxDepth: 3 });
    assert.equal(out.ok, true);
    assert.deepEqual(out.missingRoots, [join(root, 'missing')]);
    assert.deepEqual(out.projects.map(p => [p.url, p.branch]), [
      ['https://github.com/acme/app', 'main'],
      ['https://github.com/acme/app', 'ticket/001-feature'],
      ['https://github.com/acme/tool', 'detached']
    ]);
    assert.doesNotMatch(JSON.stringify(out), /s3cret/);
    assert.equal(runDiscovery({ searchRoots: [root], maxDepth: 4 }).projects.some(p => p.repo === 'deep'), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('github discovery fails closed on invalid parameters', () => {
  for (const input of [{ searchRoots: '/etc' }, { searchRoots: [] }, { searchRoots: ['relative'] }, { maxDepth: 7 }, { maxDepth: 1.5 }]) {
    const out = runDiscovery(input);
    assert.equal(out.ok, false, JSON.stringify(input));
    assert.equal(out.errorType, 'GITHUB_DISCOVERY_FAILED');
  }
});

test('cli renders registry output as csv and yaml and rejects unknown formats', () => {
  const csv = cli('procs', 'twin', '--format', 'csv');
  assert.equal(csv.status, 0, csv.stderr);
  assert.match(csv.stdout.split('\n')[0], /(^|,)uri(,|$)/);
  assert.match(csv.stdout, /proc:\/\/taskand\.dev\/twin\/environment\/v1/);
  const yaml = cli('procs', 'twin', '--format=yaml');
  assert.equal(yaml.status, 0, yaml.stderr);
  assert.match(yaml.stdout, /^ok: true$/m);
  assert.match(yaml.stdout, /uri: proc:\/\/taskand\.dev\/twin\/environment\/v1/);
  const bad = cli('procs', '--format', 'xml');
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /Nieobsługiwany format: xml/);
});

test('universal cli query lists GitHub repositories and keeps large structured results intact', () => {
  const home = mkdtempSync(join(tmpdir(), 'taskand-home-'));
  const total = 700; // wynik dev/act > 128 KiB: wcześniej obcinany przez process.exit() przed opróżnieniem potoku
  try {
    for (let i = 0; i < total; i++) {
      const dir = join(home, 'github', 'acme', `repository-with-a-deliberately-long-name-${String(i).padStart(4, '0')}`, '.git');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'config'), `[remote "origin"]\n\turl = git@github.com:acme/repo-${i}.git\n`);
      writeFileSync(join(dir, 'HEAD'), 'ref: refs/heads/main\n');
    }
    const run = (...args) => spawnSync('node', ['bin/taskand', ...args], {
      encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, HOME: home, TASKAND_GATEWAY: 'http://127.0.0.1:9' }
    });
    const json = run('lista', 'projektow', 'github', '--format', 'json');
    assert.equal(json.status, 0, json.stderr);
    const out = JSON.parse(json.stdout);
    assert.equal(out.intent, 'query');
    assert.equal(out.uri, 'proc://taskand.dev/admin/github-projects-discovery/v2');
    assert.equal(out.result.total, total);
    assert.match(out.reply, new RegExp(`Znaleziono ${total} repozytoriów GitHub w 1 kontach`));
    const csv = run('pokaż repozytoria git', '--format', 'csv').stdout.trim().split('\n');
    assert.equal(csv[0], 'path,url,account,repo,branch,lastCommit');
    assert.equal(csv.length, total + 1);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('browser-action parses natural language commands and parameters', () => {
  const t1 = parseIntent('kliknij przycisk "Ponów zapis" na stronie http://localhost:8100/connect-scenario?test=test.oql');
  assert.equal(t1.name, 'browser-action');
  const a1 = parseBrowserAction(t1.text);
  assert.equal(a1.action, 'click');
  assert.equal(a1.text, 'Ponów zapis');
  assert.equal(a1.url, 'http://localhost:8100/connect-scenario?test=test.oql');

  const t2 = parseIntent('otwórz stronę http://localhost:8100/connect-scenario');
  assert.equal(t2.name, 'browser-action');
  const a2 = parseBrowserAction(t2.text);
  assert.equal(a2.action, 'open');
  assert.equal(a2.url, 'http://localhost:8100/connect-scenario');

  const t3 = parseIntent('zrób zrzut ekranu do pliku /tmp/screen.png');
  assert.equal(t3.name, 'browser-action');
  const a3 = parseBrowserAction(t3.text);
  assert.equal(a3.action, 'screenshot');
  assert.equal(a3.output, '/tmp/screen.png');
});

const shellPython = process.env.TASKAND_SHELL_PYTHON || resolve('.subactor/cache/shell-venv/bin/python');
const shellPlan = { schema_version: '0.1', name: 'interface test', steps: [
  { id: 'hello', kind: 'generate', language: 'python', code: "print('shell E2E')\n" }
] };

test('shell preparation URI never accepts execution or client host configuration', () => {
  for (const input of [{ operation: 'run', id: 'hello' }, [], null]) {
    const r = spawnSync('node', ['generated/mcp/shell-build/taskand.dev/v1/bin.mjs'], {
      input: JSON.stringify(input), encoding: 'utf8'
    });
    assert.equal(JSON.parse(r.stdout).ok, false);
  }
  assert.equal(cli('shell', 'run', '{"operation":"export"}').status, 1);
});

test('shell CLI exports, verifies and explicitly runs through registry with digest checking', t => {
  if (!existsSync(shellPython)) return t.skip('Install packages/taskand-shell dependencies first');
  const root = mkdtempSync(join(tmpdir(), 'taskand-shell-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const invoke = (operation, data) => {
    const r = spawnSync('node', ['bin/taskand', 'shell', operation, JSON.stringify(data), '--json'], {
      encoding: 'utf8', timeout: 30000, env: { ...process.env,
        TASKAND_GATEWAY: 'http://127.0.0.1:9', TASKAND_SHELL_WORKSPACE: root, TASKAND_SHELL_PYTHON: shellPython }
    });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    return JSON.parse(r.stdout);
  };
  const exported = invoke('export', { id: 'hello', plan: shellPlan, urn: 'urn:paxlet:taskand:cli', permissions: {} });
  const digest = exported.result.digest;
  assert.ok(exported.requestId, 'local audit request id');
  assert.equal(invoke('verify', { id: 'hello' }).result.digest, digest);
  assert.equal(invoke('run', { id: 'hello', expected_digest: digest }).result.output.stdout, 'shell E2E\n');
  const denied = spawnSync('node', ['bin/taskand', 'shell', 'run', JSON.stringify({ id: 'hello', expected_digest: 'wrong' }), '--json'], {
    encoding: 'utf8', env: { ...process.env, TASKAND_GATEWAY: 'http://127.0.0.1:9',
      TASKAND_SHELL_WORKSPACE: root, TASKAND_SHELL_PYTHON: shellPython }
  });
  assert.equal(denied.status, 1);
  assert.match(denied.stdout, /digest mismatch/);
});

test('real gateway and MCP enforce separate preparation and execution grants', t => {
  if (!existsSync(shellPython)) return t.skip('Install shell and taskand-mcp dependencies first');
  const available = spawnSync(shellPython, ['-c', 'import mcp, taskand_mcp'], { encoding: 'utf8' });
  if (available.status !== 0) return t.skip('Install packages/taskand-mcp in shell test environment');
  const script = String.raw`
import asyncio, json, os, sys, tempfile, threading
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch
from mcp import Client, StdioServerParameters
from gateway import GatewayHTTPHandler
from gateway.context import Store
from nl_dsl_sh import Catalog
BUILD='proc://taskand.dev/mcp/shell-build/v1'
RUN='proc://taskand.dev/mcp/shell-run/v1'
class Quiet(GatewayHTTPHandler):
    def log_message(self, *args): pass
with tempfile.TemporaryDirectory() as tmp:
    root=Path(tmp)
    os.environ['TASKAND_SHELL_WORKSPACE']=tmp
    os.environ['TASKAND_SHELL_PYTHON']=sys.executable
    os.environ.pop('TASKAND_AUTH_TOKEN',None)
    grants={'users': {'builder':{'token':'fixture-builder','allowed_uris':[BUILD],'allowed_actions':['call']},
        'runner':{'token':'fixture-runner','allowed_uris':[RUN],'allowed_actions':['call']}}}
    source=root/'hello.sh';source.write_text("printf 'MCP shell E2E\\n'\n")
    catalog=Catalog();catalog.import_script(source,script_id='urn:nl-dsl-sh:taskand:e2e',description='hello',aliases=['przywitaj się'])
    (root/'catalogs').mkdir();catalog.save(root/'catalogs/hello.json')
    server=ThreadingHTTPServer(('127.0.0.1',0),Quiet)
    url='http://127.0.0.1:'+str(server.server_port)
    store=Store(root/'audit')
    def client(token):
        return Client(StdioServerParameters(command=sys.executable,args=['-m','taskand_mcp.server'],
            env={'TASKAND_MCP_GATEWAY_URL':url,'TASKAND_MCP_TOKEN':token}),read_timeout_seconds=30)
    async def scenario():
        async with client('fixture-builder') as c:
            planned=await c.call_tool('call_process',{'uri':BUILD,'input_data':{'operation':'plan','prompt':'przywitaj się','catalog':'hello'}})
            assert not planned.is_error, planned
            plan=planned.structured_content['result']['result']
            exported=await c.call_tool('call_process',{'uri':BUILD,'input_data':{'operation':'export','plan':plan,'catalog':'hello','id':'hello','urn':'urn:paxlet:taskand:mcp','permissions':{}}})
            assert not exported.is_error, exported
            digest=exported.structured_content['result']['result']['digest']
            assert exported.structured_content['requestId']
            denied=await c.call_tool('call_process',{'uri':RUN,'input_data':{'id':'hello','expected_digest':digest}})
            assert denied.is_error, denied
            escaped=await c.call_tool('call_process',{'uri':BUILD,'input_data':{'operation':'run','id':'hello','expected_digest':digest}})
            assert escaped.is_error, escaped
        async with client('fixture-runner') as c:
            called=await c.call_tool('call_process',{'uri':RUN,'input_data':{'id':'hello','expected_digest':digest}})
            assert not called.is_error, called
            assert called.structured_content['result']['result']['output']['stdout']=='MCP shell E2E\n'
            assert called.structured_content['result']['result']['receipt']
    with patch('gateway.auth.load_grants',return_value=grants),patch('gateway.default_store',return_value=store):
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        try: asyncio.run(scenario())
        finally: server.shutdown();server.server_close();thread.join()
print('gateway + MCP + NL reuse + Paxlet receipt PASS')
`;
  const r = spawnSync(shellPython, ['-c', script], { encoding: 'utf8', timeout: 90000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /Paxlet receipt PASS/);
});
