import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const CLI = join(process.cwd(), 'src', 'cli.js');

function makeTempDir(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

function writeOpenClawStub(binDir, logPath, jobsPath) {
  const script = String.raw`#!/usr/bin/env node
const fs = require('fs');
const logPath = process.env.OPENCLAW_STUB_LOG;
const jobsPath = process.env.OPENCLAW_STUB_JOBS;
function readJobs() {
  return JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
}
function writeJobs(jobs) {
  fs.writeFileSync(jobsPath, JSON.stringify(jobs, null, 2) + '\n');
}
function log(entry) {
  const items = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, 'utf8')) : [];
  items.push(entry);
  fs.writeFileSync(logPath, JSON.stringify(items, null, 2) + '\n');
}
const args = process.argv.slice(2);
log(args);
if (args[0] === '--help') {
  process.stdout.write('ok\n');
  process.exit(0);
}
if (args[0] !== 'cron') {
  process.stderr.write('unsupported command\n');
  process.exit(1);
}
if (args[1] === 'add') {
  const jobs = readJobs();
  const get = (flag) => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : null;
  };
  const job = {
    id: 'job-' + String(jobs.length + 1),
    agentId: get('--agent'),
    name: get('--name'),
    description: get('--description'),
    deleteAfterRun: args.includes('--delete-after-run'),
    schedule: { kind: 'at', at: get('--at') },
    sessionTarget: get('--session'),
    payload: { kind: 'agentTurn', message: get('--message') },
    delivery: {
      mode: args.includes('--announce') ? 'announce' : 'none',
      channel: get('--channel'),
      to: get('--to'),
      accountId: get('--account')
    }
  };
  jobs.push(job);
  writeJobs(jobs);
  process.stdout.write(JSON.stringify(job));
  process.exit(0);
}
if (args[1] === 'list') {
  if (process.env.OPENCLAW_STUB_SLEEP_MS) {
    const end = Date.now() + Number(process.env.OPENCLAW_STUB_SLEEP_MS);
    while (Date.now() < end) {}
  }
  process.stdout.write(JSON.stringify({ jobs: readJobs() }));
  process.exit(0);
}
if (args[1] === 'edit') {
  const jobId = args[2];
  const jobs = readJobs();
  const job = jobs.find((entry) => entry.id === jobId);
  if (!job) {
    process.stderr.write('not found\n');
    process.exit(1);
  }
  const get = (flag) => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : null;
  };
  if (get('--name')) job.name = get('--name');
  if (get('--description')) job.description = get('--description');
  if (get('--at')) job.schedule.at = get('--at');
  if (get('--message')) job.payload.message = get('--message');
  if (get('--channel')) job.delivery.channel = get('--channel');
  if (get('--account')) job.delivery.accountId = get('--account');
  if (get('--to')) job.delivery.to = get('--to');
  if (args.includes('--announce')) job.delivery.mode = 'announce';
  writeJobs(jobs);
  process.stdout.write(JSON.stringify(job));
  process.exit(0);
}
if (args[1] === 'rm') {
  const jobId = args[2];
  const jobs = readJobs();
  writeJobs(jobs.filter((entry) => entry.id !== jobId));
  process.stdout.write(JSON.stringify({ ok: true, removed: true }));
  process.exit(0);
}
process.stderr.write('unsupported cron subcommand\n');
process.exit(1);
`;
  const target = join(binDir, 'openclaw');
  writeFileSync(target, script, { mode: 0o755 });
}

function runCli(args, extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  return spawnSync('node', [CLI, ...args], { encoding: 'utf8', env });
}

test('add and list reminders with native cron metadata', () => {
  const root = makeTempDir('ocr-native-');
  const workspace = join(root, 'workspace');
  const binDir = join(root, 'bin');
  mkdirSync(workspace, { recursive: true });
  mkdirSync(binDir, { recursive: true });
  const logPath = join(root, 'log.json');
  const jobsPath = join(root, 'jobs.json');
  writeFileSync(logPath, '[]\n');
  writeFileSync(jobsPath, '[]\n');
  writeOpenClawStub(binDir, logPath, jobsPath);

  const env = {
    OPENCLAW_REMINDERS_WORKSPACE: workspace,
    PATH: `${binDir}:${process.env.PATH}`,
    OPENCLAW_STUB_LOG: logPath,
    OPENCLAW_STUB_JOBS: jobsPath,
  };

  const added = runCli(['add', '--in', '2m', '--message', 'brush teeth', '--channel', 'telegram', '--account', 'cto', '--to', '8020357623'], env);
  assert.equal(added.status, 0, added.stderr);
  const addJson = JSON.parse(added.stdout.trim());
  assert.equal(addJson.ok, true);
  assert.equal(addJson.reminder.text, 'brush teeth');
  assert.equal(addJson.reminder.channel, 'telegram');
  assert.equal(addJson.reminder.account, 'cto');
  assert.equal(addJson.reminder.to, '8020357623');

  const listed = runCli(['list', '--json'], env);
  assert.equal(listed.status, 0, listed.stderr);
  const rows = JSON.parse(listed.stdout.trim()).reminders;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].text, 'brush teeth');
  assert.match(rows[0].name, /^reminder:/);
  assert.match(rows[0].name, /brush-teeth/);

  const pretty = runCli(['list'], env);
  assert.equal(pretty.status, 0, pretty.stderr);
  assert.match(pretty.stdout, /brush teeth/);
});

test('show update and remove reminder backed by cron jobs', () => {
  const root = makeTempDir('ocr-native-');
  const workspace = join(root, 'workspace');
  const binDir = join(root, 'bin');
  mkdirSync(workspace, { recursive: true });
  mkdirSync(binDir, { recursive: true });
  const logPath = join(root, 'log.json');
  const jobsPath = join(root, 'jobs.json');
  writeFileSync(logPath, '[]\n');
  writeFileSync(jobsPath, '[]\n');
  writeOpenClawStub(binDir, logPath, jobsPath);

  const env = {
    OPENCLAW_REMINDERS_WORKSPACE: workspace,
    PATH: `${binDir}:${process.env.PATH}`,
    OPENCLAW_STUB_LOG: logPath,
    OPENCLAW_STUB_JOBS: jobsPath,
  };

  const addResult = runCli(['add', '--in', '5m', '--message', 'call bibi'], env);
  assert.equal(addResult.status, 0, addResult.stderr);
  const added = JSON.parse(addResult.stdout.trim());
  const id = added.reminder.id;

  const shown = runCli(['show', '--id', id, '--json'], env);
  assert.equal(shown.status, 0, shown.stderr);
  assert.equal(JSON.parse(shown.stdout.trim()).text, 'call bibi');

  const updated = runCli(['update', '--id', id, '--in', '10m', '--message', 'call bibi now'], env);
  assert.equal(updated.status, 0, updated.stderr);
  const updatedJson = JSON.parse(updated.stdout.trim());
  assert.equal(updatedJson.ok, true);
  assert.equal(updatedJson.reminder.text, 'call bibi now');
  assert.match(updatedJson.reminder.name, /^reminder:/);
  assert.match(updatedJson.reminder.name, /call-bibi-now/);

  const removed = runCli(['remove', '--id', id], env);
  assert.equal(removed.status, 0, removed.stderr);
  assert.equal(JSON.parse(removed.stdout.trim()).removed, id);

  const jobs = JSON.parse(readFileSync(jobsPath, 'utf8'));
  assert.equal(jobs.length, 0);
});

test('install-skill copies bundled skill into workspace', () => {
  const root = makeTempDir('ocr-native-');
  const workspace = join(root, 'workspace');
  const binDir = join(root, 'bin');
  mkdirSync(workspace, { recursive: true });
  mkdirSync(binDir, { recursive: true });
  const logPath = join(root, 'log.json');
  const jobsPath = join(root, 'jobs.json');
  writeFileSync(logPath, '[]\n');
  writeFileSync(jobsPath, '[]\n');
  writeOpenClawStub(binDir, logPath, jobsPath);

  const env = {
    OPENCLAW_REMINDERS_WORKSPACE: workspace,
    PATH: `${binDir}:${process.env.PATH}`,
    OPENCLAW_STUB_LOG: logPath,
    OPENCLAW_STUB_JOBS: jobsPath,
  };

  const result = runCli(['install-skill'], env);
  assert.equal(result.status, 0, result.stderr);
  const json = JSON.parse(result.stdout.trim());
  assert.equal(json.ok, true);
  assert.equal(json.skill.skill_dir, join(workspace, 'skills', 'openclaw-reminders'));
});

test('list filters to current context by default and --all expands scope', () => {
  const root = makeTempDir('ocr-native-');
  const workspace = join(root, 'workspace');
  const binDir = join(root, 'bin');
  mkdirSync(workspace, { recursive: true });
  mkdirSync(binDir, { recursive: true });
  const logPath = join(root, 'log.json');
  const jobsPath = join(root, 'jobs.json');
  writeFileSync(logPath, '[]\n');
  writeFileSync(jobsPath, JSON.stringify([
    {
      id: 'job-1',
      name: 'reminder:one:2026-04-12T22-00-00.000Z',
      description: `Managed by openclaw-reminders for ${workspace}`,
      deleteAfterRun: true,
      schedule: { kind: 'at', at: '2026-04-12T22:00:00.000Z' },
      sessionTarget: 'isolated',
      payload: { kind: 'agentTurn', message: 'same chat' },
      delivery: { mode: 'announce', channel: 'telegram', to: '8020357623', accountId: 'cto' }
    },
    {
      id: 'job-2',
      name: 'reminder:two:2026-04-12T22-10-00.000Z',
      description: `Managed by openclaw-reminders for ${workspace}`,
      deleteAfterRun: true,
      schedule: { kind: 'at', at: '2026-04-12T22:10:00.000Z' },
      sessionTarget: 'isolated',
      payload: { kind: 'agentTurn', message: 'other account' },
      delivery: { mode: 'announce', channel: 'telegram', to: '8020357623', accountId: 'security' }
    }
  ], null, 2) + '\n');
  writeOpenClawStub(binDir, logPath, jobsPath);

  const env = {
    OPENCLAW_REMINDERS_WORKSPACE: workspace,
    OPENCLAW_REMINDERS_CHANNEL: 'telegram',
    OPENCLAW_REMINDERS_ACCOUNT: 'cto',
    OPENCLAW_REMINDERS_TO: '8020357623',
    PATH: `${binDir}:${process.env.PATH}`,
    OPENCLAW_STUB_LOG: logPath,
    OPENCLAW_STUB_JOBS: jobsPath,
  };

  const scoped = runCli(['list', '--json'], env);
  assert.equal(scoped.status, 0, scoped.stderr);
  const scopedJson = JSON.parse(scoped.stdout.trim());
  assert.equal(scopedJson.reminders.length, 1);
  assert.equal(scopedJson.reminders[0].text, 'same chat');

  const all = runCli(['list', '--json', '--all'], env);
  assert.equal(all.status, 0, all.stderr);
  const allJson = JSON.parse(all.stdout.trim());
  assert.equal(allJson.reminders.length, 2);
});

test('list fails fast with a clear timeout error', () => {
  const root = makeTempDir('ocr-native-');
  const workspace = join(root, 'workspace');
  const binDir = join(root, 'bin');
  mkdirSync(workspace, { recursive: true });
  mkdirSync(binDir, { recursive: true });
  const logPath = join(root, 'log.json');
  const jobsPath = join(root, 'jobs.json');
  writeFileSync(logPath, '[]\n');
  writeFileSync(jobsPath, '[]\n');
  writeOpenClawStub(binDir, logPath, jobsPath);

  const env = {
    OPENCLAW_REMINDERS_WORKSPACE: workspace,
    OPENCLAW_REMINDERS_TIMEOUT_MS: '50',
    OPENCLAW_STUB_SLEEP_MS: '200',
    PATH: `${binDir}:${process.env.PATH}`,
    OPENCLAW_STUB_LOG: logPath,
    OPENCLAW_STUB_JOBS: jobsPath,
  };

  const result = runCli(['list'], env);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Timed out while talking to OpenClaw/);
});

test('supports sub-minute relative times with exact timestamps', () => {
  const root = makeTempDir('ocr-native-');
  const workspace = join(root, 'workspace');
  const binDir = join(root, 'bin');
  mkdirSync(workspace, { recursive: true });
  mkdirSync(binDir, { recursive: true });
  const logPath = join(root, 'log.json');
  const jobsPath = join(root, 'jobs.json');
  writeFileSync(logPath, '[]\n');
  writeFileSync(jobsPath, '[]\n');
  writeOpenClawStub(binDir, logPath, jobsPath);

  const env = {
    OPENCLAW_REMINDERS_WORKSPACE: workspace,
    PATH: `${binDir}:${process.env.PATH}`,
    OPENCLAW_STUB_LOG: logPath,
    OPENCLAW_STUB_JOBS: jobsPath,
  };

  const beforeMs = Date.now();
  const result = runCli(['add', '--in', '10s', '--message', 'brush teeth'], env);
  assert.equal(result.status, 0);

  const jobs = JSON.parse(readFileSync(jobsPath, 'utf8'));
  assert.equal(jobs.length, 1);
  const runAt = jobs[0].schedule?.at;
  const runAtMs = Date.parse(runAt);
  assert.ok(Number.isFinite(runAtMs), 'expected ISO timestamp');
  assert.ok(runAtMs >= beforeMs + 9000, `expected runAt >= before + 9s, got ${runAt}`);
  assert.ok(runAtMs <= beforeMs + 20000, `expected runAt <= before + 20s, got ${runAt}`);
  assert.match(runAt, /:\d{2}\.\d{3}Z$/);
});
