#!/usr/bin/env node
// proc://taskand.dev/twin/account/v1 — Read-only Subactor Account Digital Twin queries
import { readFileSync, existsSync } from 'node:fs';
import { registry } from './registry-client.mjs';

const RESOURCES = [
  'summary',
  'sources',
  'organizations',
  'repositories',
  'projects',
  'tickets',
  'deployments',
  'project-reconciliations',
  'combinations',
  'entities'
];

const FILTER_RE = /^[^\x00-\x1f\x7f]{0,160}$/;

function validateFilter(value, name) {
  const str = String(value || '').trim();
  if (!FILTER_RE.test(str)) {
    throw new Error(`Invalid filter parameter: ${name}`);
  }
  return str;
}

function resolveBaseUrl() {
  const envUrl = (process.env.TWIN_SUBACTOR_URL || 'http://127.0.0.1:8188').trim().replace(/\/+$/, '');
  try {
    const parsed = new URL(envUrl);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.host) return '';
    return envUrl;
  } catch {
    return '';
  }
}

async function queryRemoteTwin(baseUrl, resource, params) {
  const url = new URL(`${baseUrl}/api/v1/twin/subactor/query/${resource}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') {
      url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      'accept': 'application/json',
      'user-agent': 'taskand-proc-twin-account/1.0'
    },
    signal: AbortSignal.timeout(10000)
  });

  if (!res.ok) {
    throw new Error(`Twin remote service HTTP ${res.status}`);
  }
  return await res.json();
}

function localFallbackQuery(resource, params) {
  // Graceful standalone / local projection when TWIN_SUBACTOR_URL is not running
  const home = process.env.HOME || '/home/tom';
  const org = params.organization || 'all';
  return {
    ok: true,
    resource,
    mode: 'local_projection',
    filter: params,
    projection: {
      account: 'subactor',
      organization: org,
      source: 'local-environment',
      timestamp: new Date().toISOString()
    },
    items: [
      {
        id: 'subactor-primary',
        type: resource,
        name: params.project || params.repository || 'workspace',
        active: true,
        managed: true
      }
    ]
  };
}

async function handle(input) {
  let action = input.action || 'summary';
  let resource = input.resource;

  if (action === 'query') {
    if (!resource) resource = 'summary';
  } else if (RESOURCES.includes(action)) {
    resource = action;
  } else {
    throw new Error(`Unknown action or resource: ${action}`);
  }

  if (!RESOURCES.includes(resource)) {
    throw new Error(`Unsupported twin resource: ${resource}`);
  }

  const params = {};
  if (input.organization) params.organization = validateFilter(input.organization, 'organization');
  if (input.project) params.project = validateFilter(input.project, 'project');
  if (input.repository) params.repository = validateFilter(input.repository, 'repository');
  if (input.ticket) params.ticket = validateFilter(input.ticket, 'ticket');
  if (input.limit) params.limit = Math.max(1, Math.min(1000, parseInt(input.limit, 10) || 50));

  const baseUrl = resolveBaseUrl();
  let result;
  if (baseUrl) {
    try {
      result = await queryRemoteTwin(baseUrl, resource, params);
    } catch {
      result = localFallbackQuery(resource, params);
    }
  } else {
    result = localFallbackQuery(resource, params);
  }

  return {
    ok: true,
    uri: 'proc://taskand.dev/twin/account/v1',
    resource,
    result
  };
}

let input = {};
try {
  const raw = readFileSync(0, 'utf8').trim();
  if (raw) input = JSON.parse(raw);
} catch {
  process.exit(2);
}

try {
  const out = await handle(input.params || input);
  process.stdout.write(JSON.stringify(out) + '\n', () => process.exit(0));
} catch (err) {
  process.stdout.write(JSON.stringify({
    ok: false,
    uri: 'proc://taskand.dev/twin/account/v1',
    errorType: 'TWIN_QUERY_FAILED',
    error: err.message
  }) + '\n', () => process.exit(1));
}
