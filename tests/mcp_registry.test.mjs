import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

test('MCP has one reserved root and preserves generated lookup', async () => {
  const root = mkdtempSync(join(tmpdir(), 'taskand-mcp-registry-'));
  try {
    const target = join(root, 'generated/registry/core/taskand.dev/v1');
    mkdirSync(target, { recursive: true });
    cpSync(new URL('../generated/registry/core/taskand.dev/v1/store.mjs', import.meta.url), join(target, 'store.mjs'));
    const store = await import(pathToFileURL(join(target, 'store.mjs')));
    mkdirSync(join(root, 'mcp/mcp-fixture'), { recursive: true });
    writeFileSync(join(root, 'mcp/mcp-fixture/registry.json'), JSON.stringify({ processes: { example: { uri: 'fixture' } } }));
    assert.equal(store.parseUri('proc://taskand.dev/mcp-fixture/add/v1').dir, join(root, 'mcp/mcp-fixture/add/taskand.dev/v1'));
    assert.equal(store.parseUri('proc://taskand.dev/file/ops/v1').dir, join(root, 'generated/file/ops/taskand.dev/v1'));
    assert.equal(store.parseUri('proc://taskand.dev/mcp-fixture/../v1'), null);
    assert.ok(store.organisms().includes('mcp-fixture'));
    assert.equal(store.allEntries().find(e => e.uri === 'fixture').uri, 'fixture');
    mkdirSync(join(root, 'generated/mcp-fixture'));
    assert.throws(() => store.parseUri('proc://taskand.dev/mcp-fixture/add/v1'), /MCP_NAMESPACE_COLLISION/);
    symlinkSync(join(root, 'generated/file'), join(root, 'mcp/mcp-link'));
    // Even dangling symlinks must be rejected before a later target appears.
    assert.throws(() => store.parseUri('proc://taskand.dev/mcp-link/add/v1'), /REGISTRY_SYMLINK/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
