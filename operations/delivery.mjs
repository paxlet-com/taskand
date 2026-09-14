// Resumable delivery coordinator. It delegates effects to Koru, Goal and the
// protected Validator; this module never implements their policy or merge.
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const TICKET = /^ticket-[0-9]{3,}$/;
const SHA = /^[0-9a-f]{40}$/;
const STATE_SCHEMA = 'taskand.delivery-controller/v1';
const TERMINAL = new Set(['MERGED', 'CLOSED', 'BLOCKED']);

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function git(repo, args) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', timeout: 15000 }).trim();
}

function remoteRepository(remote) {
  const match = String(remote || '').match(/github\.com(?::|\/)([^/]+)\/([^/]+?)(?:\.git)?$/i);
  return match ? `${match[1]}/${match[2]}` : null;
}

function parseOption(args, index, option) {
  if (index + 1 >= args.length || !args[index + 1] || args[index + 1].startsWith('--')) {
    throw new Error(`${option.toUpperCase().replaceAll('-', '_')}_VALUE_REQUIRED`);
  }
  return args[index + 1];
}

export function parseDeliveryArgs(rawArgs = []) {
  const options = {
    ticket: null,
    repo: process.cwd(),
    stateDir: null,
    pullRequest: false,
    wait: false,
    merge: false,
    keyFile: null,
    correlationId: null,
    koru: process.env.TASKAND_KORU_BIN || 'koru',
    goal: process.env.TASKAND_GOAL_BIN || 'goal',
    validator: process.env.TASKAND_VALIDATOR_SCRIPT || 'run-local-direct-pr.sh'
  };
  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    if (arg === '--ticket') options.ticket = parseOption(rawArgs, i++, arg);
    else if (arg === '--repo') options.repo = parseOption(rawArgs, i++, arg);
    else if (arg === '--state-dir') options.stateDir = parseOption(rawArgs, i++, arg);
    else if (arg === '--key-file') options.keyFile = parseOption(rawArgs, i++, arg);
    else if (arg === '--correlation-id') options.correlationId = parseOption(rawArgs, i++, arg);
    else if (arg === '--pull-request') options.pullRequest = true;
    else if (arg === '--wait') options.wait = true;
    else if (arg === '--merge') options.merge = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`UNKNOWN_DELIVERY_OPTION:${arg}`);
  }
  if (options.help) return options;
  if (!options.ticket || !TICKET.test(options.ticket)) throw new Error('TICKET_INVALID');
  if (options.wait && !options.pullRequest) throw new Error('WAIT_REQUIRES_PULL_REQUEST');
  if (options.merge && (!options.pullRequest || !options.wait)) {
    throw new Error('MERGE_REQUIRES_PULL_REQUEST_AND_WAIT');
  }
  if ((options.wait || options.merge) && !options.keyFile) throw new Error('KEY_FILE_REQUIRED');
  options.repo = resolve(options.repo);
  options.correlationId ||= `taskand-${options.ticket}-${digest(options.ticket).slice(0, 16)}`;
  options.stateDir = resolve(options.stateDir || process.env.TASKAND_DELIVERY_STATE_DIR ||
    join(process.env.XDG_STATE_HOME || join(homedir(), '.local', 'state'), 'taskand', 'deliveries'));
  return options;
}

export function observeRepository(repo) {
  const root = git(repo, ['rev-parse', '--show-toplevel']);
  const branch = git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD']) || null;
  const head = git(root, ['rev-parse', 'HEAD']);
  const remote = (() => {
    try { return git(root, ['remote', 'get-url', 'origin']); } catch { return null; }
  })();
  const base = (() => {
    try { return git(root, ['rev-parse', 'origin/main']); } catch { return null; }
  })();
  const dirty = git(root, ['status', '--porcelain']);
  return {
    root,
    branch,
    head,
    base,
    remote,
    repository: remoteRepository(remote),
    dirtyPaths: dirty ? dirty.split('\n').filter(Boolean).length : 0,
    ticketPath: null
  };
}

function statePath(options, observation) {
  return join(options.stateDir, `${digest(`${observation.root}\n${options.ticket}`)}.json`);
}

function writeState(file, state) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify({...state, updatedAt: new Date().toISOString()}, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, file);
}

function readState(file) {
  if (!existsSync(file)) return null;
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
}

function ticketStatus(observation, ticket) {
  const path = join(observation.root, 'project', ticket, 'README.md');
  if (!existsSync(path)) return { path, exists: false, active: false };
  const text = readFileSync(path, 'utf8');
  return { path, exists: true, active: /\*\*Status\*\*:\s*IN_PROGRESS\b/.test(text) };
}

function commands(options, observation, pr = null) {
  const result = [
    { name: 'queue', executable: options.koru, args: ['--queue', '--project', observation.root, '--ticket', options.ticket, '--actor', 'taskand-deliver', '--format', 'json', '--no-include-fixtures'] },
    { name: 'goal', executable: options.goal, args: ['--delivery-mode', 'pull-request', '--yes', 'push', '--ticket', options.ticket, '--no-tag', '--no-changelog', '--no-version-sync', '--no-publish'] },
    { name: 'discover-pr', executable: 'gh', args: ['pr', 'list', '--repo', observation.repository || 'OWNER/REPO', '--head', observation.branch || 'BRANCH', '--state', 'open', '--json', 'number,headRefName,headRefOid,url', '--limit', '1'] }
  ];
  if (pr) {
    const validatorArgs = ['--repository', observation.repository, '--pull-request', String(pr.number), '--ticket', options.ticket, '--expected-head-sha', pr.headSha, '--correlation-id', options.correlationId];
    if (options.keyFile) validatorArgs.push('--key-file', options.keyFile);
    if (options.merge) validatorArgs.push('--merge');
    else if (options.wait) validatorArgs.push('--apply');
    result.push({ name: 'validator', executable: options.validator, args: validatorArgs });
  }
  return result;
}

function runCommand(command, cwd) {
  const result = spawnSync(command.executable, command.args, {
    cwd, encoding: 'utf8', timeout: 15 * 60 * 1000, maxBuffer: 8 * 1024 * 1024
  });
  let parsed = null;
  try { parsed = JSON.parse((result.stdout || '').trim().split('\n').pop() || ''); } catch { /* textual tools are advisory */ }
  return {
    ok: result.status === 0,
    exitCode: result.status,
    signal: result.signal || null,
    result: parsed,
    error: result.status === 0 ? null : (result.error?.code || 'DELIVERY_COMMAND_FAILED')
  };
}

function discoverPullRequest(run, observation) {
  const value = run.discovery ?? run.result;
  const candidates = Array.isArray(value) ? value : value ? [value] : [];
  const item = candidates[0];
  if (!item || !Number.isInteger(item.number) || !item.headRefName || !SHA.test(item.headRefOid || '')) return null;
  return { number: item.number, branch: item.headRefName, headSha: item.headRefOid, url: item.url || null };
}

export function buildDeliveryPlan(options, observation) {
  const ticket = ticketStatus(observation, options.ticket);
  return {
    schema: STATE_SCHEMA,
    mode: options.pullRequest ? 'effect-enabled' : 'plan-only',
    repository: observation.repository,
    root: observation.root,
    ticket: options.ticket,
    branch: observation.branch,
    headSha: observation.head,
    baseSha: observation.base,
    dirtyPaths: observation.dirtyPaths,
    ticketExists: ticket.exists,
    ticketActive: ticket.active,
    commands: commands(options, observation),
    gates: {
      pullRequest: options.pullRequest,
      wait: options.wait,
      merge: options.merge,
      protectedValidator: Boolean(options.wait || options.merge)
    }
  };
}

export function deliver(rawArgs, dependencies = {}) {
  let options;
  try { options = parseDeliveryArgs(rawArgs); }
  catch (error) { return { ok: false, status: 'REJECTED', error: error.message }; }
  if (options.help) return { ok: true, status: 'HELP', usage: 'taskand deliver --ticket ticket-NNN [--pull-request --wait --merge --key-file PATH]' };

  let observation;
  try { observation = (dependencies.observe || observeRepository)(options.repo); }
  catch (error) { return { ok: false, status: 'BLOCKED', error: `REPOSITORY_OBSERVATION_FAILED:${error.message}` }; }
  const plan = buildDeliveryPlan(options, observation);
  const file = statePath(options, observation);
  const previous = readState(file);
  if (previous && previous.status === 'MERGED') return { ok: true, status: 'IDEMPOTENT', resumed: true, stateFile: file, state: previous };
  if (!plan.repository) return { ok: false, status: 'BLOCKED', error: 'GITHUB_ORIGIN_REQUIRED', plan, stateFile: file };
  if (!plan.ticketExists || !plan.ticketActive) return { ok: false, status: 'BLOCKED', error: 'ACTIVE_TICKET_REQUIRED', plan, stateFile: file };
  if (plan.branch === 'main' || !plan.branch) return { ok: false, status: 'BLOCKED', error: 'DELIVERY_BRANCH_REQUIRED', plan, stateFile: file };

  const state = previous || {
    schema: STATE_SCHEMA, idempotencyKey: digest(`${observation.root}\n${options.ticket}`),
    repository: plan.repository, root: observation.root, ticket: options.ticket,
    branch: observation.branch, requested: { pullRequest: options.pullRequest, wait: options.wait, merge: options.merge },
    status: 'PLANNED', steps: []
  };
  state.plan = plan;
  writeState(file, state);
  if (!options.pullRequest) return { ok: true, status: 'PLAN_READY', resumed: Boolean(previous), stateFile: file, plan };

  const runner = dependencies.runCommand || runCommand;
  const executed = new Map((state.steps || []).map(step => [step.name, step]));
  const run = command => {
    const old = executed.get(command.name);
    // A PR is an external, mutable observation. Re-read it on every resume so
    // a moved head can never inherit an earlier discovery result.
    if (old?.ok && command.name !== 'discover-pr') return old;
    const result = runner(command, observation.root);
    const discovered = command.name === 'discover-pr' && discoverPullRequest({ result: result.result }, observation);
    const ok = result.ok && (command.name !== 'discover-pr' || Boolean(discovered));
    const step = { name: command.name, executable: command.executable, args: command.args, ok, exitCode: result.exitCode, error: ok ? null : (result.error || (command.name === 'discover-pr' ? 'PULL_REQUEST_NOT_FOUND' : 'DELIVERY_COMMAND_FAILED')) };
    if (command.name === 'discover-pr' && result.result) step.discovery = result.result;
    executed.set(command.name, step);
    state.steps = [...executed.values()];
    state.status = result.ok ? 'RUNNING' : 'BLOCKED';
    writeState(file, state);
    return step;
  };
  const queue = run(commands(options, observation)[0]);
  if (!queue.ok) return { ok: false, status: 'BLOCKED', error: `KORU_FAILED:${queue.error}`, stateFile: file, state };
  const goal = run(commands(options, observation)[1]);
  if (!goal.ok) return { ok: false, status: 'BLOCKED', error: `GOAL_FAILED:${goal.error}`, stateFile: file, state };
  try { observation = (dependencies.observe || observeRepository)(options.repo); }
  catch (error) {
    state.status = 'OUTCOME_UNKNOWN';
    writeState(file, state);
    return { ok: false, status: state.status, error: `POST_GOAL_OBSERVATION_FAILED:${error.message}`, stateFile: file, state };
  }
  state.branch = observation.branch;
  state.headSha = observation.head;
  const discovery = run(commands(options, observation)[2]);
  const pr = discoverPullRequest(discovery, observation);
  if (!pr) {
    state.status = 'WAITING_PR';
    writeState(file, state);
    return { ok: false, status: state.status, error: 'PULL_REQUEST_NOT_DISCOVERED', stateFile: file, state };
  }
  state.pullRequest = pr;
  if (!options.wait) {
    state.status = 'PR_READY';
    writeState(file, state);
    return { ok: true, status: state.status, resumed: Boolean(previous), stateFile: file, state };
  }
  const validator = run(commands(options, observation, pr).at(-1));
  if (!validator.ok) {
    state.status = 'BLOCKED';
    writeState(file, state);
    return { ok: false, status: state.status, error: `VALIDATOR_FAILED:${validator.error}`, stateFile: file, state };
  }
  state.status = options.merge ? 'MERGED' : options.wait ? 'REVIEWED' : 'PR_READY';
  writeState(file, state);
  return { ok: true, status: state.status, resumed: Boolean(previous), stateFile: file, state };
}

export function renderDelivery(result) {
  if (result.status === 'HELP') return result.usage;
  if (result.plan) {
    return [`${result.status}: ${result.plan.ticket} @ ${result.plan.branch || 'detached'}`, `HEAD ${result.plan.headSha}`, `state: ${result.stateFile || 'not written'}`, ...result.plan.commands.map(c => `  ${c.name}: ${c.executable} ${c.args.join(' ')}`), result.error ? `✗ ${result.error}` : ''].filter(Boolean).join('\n');
  }
  return `${result.ok ? '✓' : '✗'} ${result.status}${result.error ? `: ${result.error}` : ''}${result.stateFile ? `\nstate: ${result.stateFile}` : ''}`;
}
