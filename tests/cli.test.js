import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(process.cwd());
const cli = join(root, 'bin', 'openclaw-reminders');

function runCli({ dbPath, workspace, home, args }) {
  return spawnSync('node', [cli, ...args], {
    env: {
      ...process.env,
      OPENCLAW_REMINDERS_DB: dbPath,
      OPENCLAW_REMINDERS_WORKSPACE: workspace,
      HOME: home,
    },
    encoding: 'utf8',
  });
}

test('add and list reminders with agent metadata', () => {
  const dir = mkdtempSync(join(tmpdir(), 'openclaw-reminders-'));
  const workspace = join(dir, 'workspace');
  mkdirSync(workspace, { recursive: true });
  const dbPath = join(workspace, '.openclaw-reminders', 'reminders.db');

  const add = runCli({
    dbPath,
    workspace,
    home: dir,
    args: ['add', '--in', '+10m', '--agent', 'cto', '--message', 'Check deploy'],
  });
  assert.equal(add.status, 0);
  const created = JSON.parse(add.stdout.trim());
  assert.equal(created.ok, true);
  assert.equal(created.creator_agent_id, 'cto');
  assert.equal(created.target_agent_id, 'cto');

  const list = runCli({ dbPath, workspace, home: dir, args: ['list'] });
  assert.equal(list.status, 0);
  const row = JSON.parse(list.stdout.trim());
  assert.equal(row.workspace_path, workspace);
  assert.equal(row.creator_agent_id, 'cto');
  assert.equal(row.target_agent_id, 'cto');
  assert.equal(row.kind, 'openclaw_message');
});

test('show, update, and remove a reminder', () => {
  const dir = mkdtempSync(join(tmpdir(), 'openclaw-reminders-'));
  const workspace = join(dir, 'workspace');
  mkdirSync(workspace, { recursive: true });
  const dbPath = join(workspace, '.openclaw-reminders', 'reminders.db');

  const add = runCli({
    dbPath,
    workspace,
    home: dir,
    args: ['add', '--at', '2026-04-12T09:00:00Z', '--agent', 'cto', '--message', 'Original reminder'],
  });
  assert.equal(add.status, 0);
  const created = JSON.parse(add.stdout.trim());

  const show = runCli({ dbPath, workspace, home: dir, args: ['show', '--id', String(created.id)] });
  assert.equal(show.status, 0);
  const shown = JSON.parse(show.stdout.trim());
  assert.equal(shown.id, created.id);
  assert.equal(shown.target_agent_id, 'cto');

  const update = runCli({
    dbPath,
    workspace,
    home: dir,
    args: ['update', '--id', String(created.id), '--in', '+2h', '--message', 'Updated reminder', '--agent', 'product'],
  });
  assert.equal(update.status, 0);
  const updated = JSON.parse(update.stdout.trim()).reminder;
  assert.equal(updated.target_agent_id, 'product');
  const updatedPayload = JSON.parse(updated.payload);
  assert.equal(updatedPayload.message, 'Updated reminder');
  assert.equal(updatedPayload.agent, 'product');

  const remove = runCli({ dbPath, workspace, home: dir, args: ['remove', '--id', String(created.id)] });
  assert.equal(remove.status, 0);
  const removed = JSON.parse(remove.stdout.trim());
  assert.equal(removed.removed, created.id);

  const list = runCli({ dbPath, workspace, home: dir, args: ['list'] });
  assert.equal(list.status, 0);
  assert.equal(list.stdout.trim(), '');
});

test('install-skill copies bundled skill into workspace', () => {
  const dir = mkdtempSync(join(tmpdir(), 'openclaw-reminders-'));
  const workspace = join(dir, 'workspace');
  mkdirSync(workspace, { recursive: true });
  const dbPath = join(workspace, '.openclaw-reminders', 'reminders.db');

  const install = runCli({ dbPath, workspace, home: dir, args: ['install-skill'] });
  assert.equal(install.status, 0);
  const skillPath = join(workspace, 'skills', 'openclaw-reminders', 'SKILL.md');
  assert.equal(existsSync(skillPath), true);
  const skillBody = readFileSync(skillPath, 'utf8');
  assert.match(skillBody, /Durable reminder management for OpenClaw/);
});

test('run-due marks due shell reminder done', () => {
  const dir = mkdtempSync(join(tmpdir(), 'openclaw-reminders-'));
  const workspace = join(dir, 'workspace');
  mkdirSync(workspace, { recursive: true });
  const dbPath = join(workspace, '.openclaw-reminders', 'reminders.db');

  const add = runCli({
    dbPath,
    workspace,
    home: dir,
    args: ['add', '--at', '2020-01-01T00:00:00Z', '--agent', 'cto', '--kind', 'shell', '--payload', 'true'],
  });
  assert.equal(add.status, 0);

  const run = runCli({ dbPath, workspace, home: dir, args: ['run-due'] });
  assert.equal(run.status, 0);
  const line = JSON.parse(run.stdout.trim());
  assert.equal(line.status, 'done');
  assert.equal(existsSync(dbPath), true);
});
