#!/usr/bin/env node
import { DatabaseSync as Database } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const APP_DIR_NAME = '.openclaw-reminders';
const CONFIG_PATH = join(homedir(), '.openclaw', 'openclaw-reminders.json');
const DEFAULT_WORKSPACE_CANDIDATES = [
  process.env.OPENCLAW_WORKSPACE,
  join(homedir(), '.openclaw', 'workspace'),
].filter(Boolean);
const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(CURRENT_DIR, '..');
const BUNDLED_SKILL_DIR = join(PACKAGE_ROOT, 'skills', 'openclaw-reminders');

function utcNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function parseTime(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`invalid time: ${value}`);
  }
  return parsed.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function parseDuration(value) {
  const match = /^\+(\d+)(s|m|h|d)$/.exec(value.trim());
  if (!match) {
    throw new Error(`invalid relative time: ${value}`);
  }
  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return new Date(Date.now() + amount * multipliers[unit]).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function resolveRunAt(options) {
  if (options.at) return parseTime(options.at);
  if (options.in) return parseDuration(options.in);
  if (options['run-at']) return parseTime(options['run-at']);
  throw new Error('missing time: use --at, --in, or --run-at');
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = rest[i + 1];
    if (!next || next.startsWith('--')) {
      options[key] = true;
      continue;
    }
    options[key] = next;
    i += 1;
  }
  return { command, options };
}

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) return null;
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
}

function saveConfig(config) {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
}

function findWorkspace() {
  for (const candidate of DEFAULT_WORKSPACE_CANDIDATES) {
    if (candidate && existsSync(candidate)) return resolve(candidate);
  }
  return null;
}

function prompt(question) {
  return new Promise((resolvePromise) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolvePromise(answer.trim());
    });
  });
}

async function ensureWorkspaceInteractive() {
  const detected = findWorkspace();
  if (detected) return detected;
  const pasted = await prompt('Paste your OpenClaw workspace path: ');
  if (!pasted) throw new Error('workspace path is required');
  const resolved = resolve(pasted);
  if (!existsSync(resolved)) throw new Error(`workspace path does not exist: ${resolved}`);
  return resolved;
}

function getWorkspace(options = {}) {
  const explicit = options.workspace || process.env.OPENCLAW_REMINDERS_WORKSPACE;
  if (explicit) return resolve(explicit);
  const config = loadConfig();
  if (config?.workspace) return resolve(config.workspace);
  const detected = findWorkspace();
  if (detected) return detected;
  throw new Error('workspace not configured. Run `openclaw-reminders setup`.');
}

function getDbPath(options = {}) {
  if (process.env.OPENCLAW_REMINDERS_DB) return resolve(process.env.OPENCLAW_REMINDERS_DB);
  const workspace = getWorkspace(options);
  return join(workspace, APP_DIR_NAME, 'reminders.db');
}

function connect(options = {}) {
  const dbPath = getDbPath(options);
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_path TEXT NOT NULL,
      creator_agent_id TEXT NOT NULL,
      target_agent_id TEXT NOT NULL,
      run_at TEXT NOT NULL,
      kind TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT
    )
  `);
  return db;
}

function ensureOpenClawInstalled() {
  const result = spawnSync('openclaw', ['--help'], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error('openclaw CLI is required but was not found');
  }
}

function copyDirectoryRecursive(sourceDir, targetDir) {
  mkdirSync(targetDir, { recursive: true });
  for (const entry of readdirSync(sourceDir)) {
    const sourcePath = join(sourceDir, entry);
    const targetPath = join(targetDir, entry);
    const stats = statSync(sourcePath);
    if (stats.isDirectory()) {
      copyDirectoryRecursive(sourcePath, targetPath);
    } else {
      mkdirSync(dirname(targetPath), { recursive: true });
      copyFileSync(sourcePath, targetPath);
    }
  }
}

function installSkill(options = {}) {
  const workspace = getWorkspace(options);
  const targetDir = join(workspace, 'skills', 'openclaw-reminders');
  if (!existsSync(BUNDLED_SKILL_DIR)) {
    throw new Error(`bundled skill not found: ${BUNDLED_SKILL_DIR}`);
  }
  copyDirectoryRecursive(BUNDLED_SKILL_DIR, targetDir);
  return { skill_dir: targetDir };
}

function getRunnerMessage() {
  return 'Run openclaw-reminders run-due and report only if work was done or something failed.';
}

function installRunner(options = {}) {
  const workspace = getWorkspace(options);
  const args = [
    'cron', 'add',
    '--agent', options.agent || 'cto',
    '--session', 'isolated',
    '--every', '1m',
    '--name', 'openclaw-reminders-runner',
    '--description', `Run due reminders for ${workspace}`,
    '--message', getRunnerMessage(),
    '--tools', 'exec,read,write',
    '--no-deliver',
    '--json',
  ];
  const result = spawnSync('openclaw', args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'failed to install OpenClaw cron runner').trim());
  }
  return JSON.parse(result.stdout.trim());
}

function runShell(payload) {
  const result = spawnSync(payload, { shell: true, stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`shell command failed with code ${result.status}`);
  }
}

function runOpenClawMessage(payload, row) {
  const data = JSON.parse(payload);
  const args = [
    'cron', 'add',
    '--agent', row.target_agent_id || data.agent || row.creator_agent_id,
    '--session', data.session || 'main',
    '--at', data.at || '+5s',
    '--message', data.message,
    '--delete-after-run',
    '--json',
  ];
  if (data.channel) args.push('--channel', data.channel);
  if (data.account) args.push('--account', data.account);
  const result = spawnSync('openclaw', args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'openclaw cron add failed').trim());
  }
}

function normalizeId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`invalid reminder id: ${value}`);
  }
  return id;
}

function getReminderOrThrow(db, workspace, id) {
  const row = db.prepare('SELECT * FROM reminders WHERE workspace_path = ? AND id = ?').get(workspace, id);
  if (!row) {
    throw new Error(`reminder not found: ${id}`);
  }
  return row;
}

function buildPayloadFromMessage(row, message, targetAgentId) {
  if (row.kind !== 'openclaw_message') return row.payload;
  let data;
  try {
    data = JSON.parse(row.payload);
  } catch {
    data = {};
  }
  if (message) data.message = message;
  if (targetAgentId) data.agent = targetAgentId;
  return JSON.stringify(data);
}

function addReminder(options) {
  const workspace = getWorkspace(options);
  const db = connect(options);
  const runAt = resolveRunAt(options);
  const creatorAgentId = options['creator-agent'] || options.agent || 'unknown';
  const targetAgentId = options['target-agent'] || options.agent || creatorAgentId;
  const kind = options.kind || 'openclaw_message';
  const payload = options.payload || JSON.stringify({
    at: '+5s',
    agent: targetAgentId,
    session: 'main',
    message: options.message,
  });
  const stmt = db.prepare('INSERT INTO reminders (workspace_path, creator_agent_id, target_agent_id, run_at, kind, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const info = stmt.run(workspace, creatorAgentId, targetAgentId, runAt, kind, payload, utcNow());
  console.log(JSON.stringify({ ok: true, id: Number(info.lastInsertRowid), run_at: runAt, workspace, creator_agent_id: creatorAgentId, target_agent_id: targetAgentId }));
}

function listReminders(options) {
  const db = connect(options);
  const workspace = getWorkspace(options);
  const rows = db.prepare('SELECT id, workspace_path, creator_agent_id, target_agent_id, run_at, kind, status, attempts, created_at, started_at, finished_at, payload, last_error FROM reminders WHERE workspace_path = ? ORDER BY run_at ASC').all(workspace);
  for (const row of rows) {
    console.log(JSON.stringify(row));
  }
}

function showReminder(options) {
  const db = connect(options);
  const workspace = getWorkspace(options);
  const id = normalizeId(options.id);
  const row = getReminderOrThrow(db, workspace, id);
  console.log(JSON.stringify(row));
}

function removeReminder(options) {
  const db = connect(options);
  const workspace = getWorkspace(options);
  const id = normalizeId(options.id);
  getReminderOrThrow(db, workspace, id);
  db.prepare('DELETE FROM reminders WHERE workspace_path = ? AND id = ?').run(workspace, id);
  console.log(JSON.stringify({ ok: true, removed: id }));
}

function updateReminder(options) {
  const db = connect(options);
  const workspace = getWorkspace(options);
  const id = normalizeId(options.id);
  const row = getReminderOrThrow(db, workspace, id);

  const nextRunAt = (options.at || options.in || options['run-at']) ? resolveRunAt(options) : row.run_at;
  const nextTargetAgentId = options['target-agent'] || options.agent || row.target_agent_id;
  const nextStatus = options.status || row.status;
  const nextMessage = options.message || null;
  const nextPayload = options.payload || buildPayloadFromMessage(row, nextMessage, nextTargetAgentId);

  db.prepare(`
    UPDATE reminders
    SET run_at = ?,
        target_agent_id = ?,
        payload = ?,
        status = ?,
        last_error = CASE WHEN ? = 'pending' THEN NULL ELSE last_error END,
        finished_at = CASE WHEN ? = 'pending' THEN NULL ELSE finished_at END,
        started_at = CASE WHEN ? = 'pending' THEN NULL ELSE started_at END
    WHERE workspace_path = ? AND id = ?
  `).run(nextRunAt, nextTargetAgentId, nextPayload, nextStatus, nextStatus, nextStatus, nextStatus, workspace, id);

  const updated = getReminderOrThrow(db, workspace, id);
  console.log(JSON.stringify({ ok: true, reminder: updated }));
}

function executeRow(db, row) {
  db.prepare("UPDATE reminders SET status='running', attempts=attempts+1, started_at=? WHERE id=?").run(utcNow(), row.id);
  try {
    if (row.kind === 'shell') {
      runShell(row.payload);
    } else if (row.kind === 'openclaw_message') {
      runOpenClawMessage(row.payload, row);
    } else {
      throw new Error(`unsupported kind: ${row.kind}`);
    }
    db.prepare("UPDATE reminders SET status='done', finished_at=?, last_error=NULL WHERE id=?").run(utcNow(), row.id);
    console.log(JSON.stringify({ id: row.id, status: 'done', target_agent_id: row.target_agent_id }));
  } catch (error) {
    db.prepare("UPDATE reminders SET status='failed', finished_at=?, last_error=? WHERE id=?").run(utcNow(), String(error.message || error), row.id);
    console.log(JSON.stringify({ id: row.id, status: 'failed', error: String(error.message || error), target_agent_id: row.target_agent_id }));
  }
}

function runDue(options) {
  const db = connect(options);
  const workspace = getWorkspace(options);
  const rows = db.prepare("SELECT * FROM reminders WHERE workspace_path = ? AND status='pending' AND run_at <= ? ORDER BY run_at ASC, id ASC").all(workspace, utcNow());
  if (rows.length === 0) {
    console.log(JSON.stringify({ ok: true, ran: 0, workspace }));
    return;
  }
  for (const row of rows) {
    executeRow(db, row);
  }
}

async function setup(options) {
  ensureOpenClawInstalled();
  const workspace = options.workspace ? resolve(options.workspace) : await ensureWorkspaceInteractive();
  const config = { workspace };
  saveConfig(config);
  connect({ workspace }).close();
  const skill = installSkill({ workspace });
  const runner = installRunner({ workspace, agent: options.agent || 'cto' });
  console.log(JSON.stringify({ ok: true, workspace, db_path: join(workspace, APP_DIR_NAME, 'reminders.db'), skill, runner }));
  process.stderr.write(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅  Setup complete!

👉  Restart OpenClaw to activate the new skill:

       openclaw gateway restart

Then just talk to your agents naturally.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

function printHelp() {
  console.log(`openclaw-reminders

Setup once:
  openclaw-reminders setup

Then just talk to your agents naturally.

Advanced commands:
  add --at <ISO> | --in <+1h> --agent <id> --message <text>
  list
  show --id <id>
  update --id <id> [--at <ISO> | --in <+1h>] [--message <text>] [--agent <id>] [--status <pending|failed|done>]
  remove --id <id>
  run-due
  install-runner
  install-skill`);
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (!command || command === '--help' || command === 'help') {
    printHelp();
    return;
  }
  if (command === 'setup') {
    await setup(options);
    return;
  }
  if (command === 'install-runner') {
    const runner = installRunner(options);
    console.log(JSON.stringify({ ok: true, runner }));
    return;
  }
  if (command === 'install-skill') {
    const skill = installSkill(options);
    console.log(JSON.stringify({ ok: true, skill }));
    return;
  }
  if (command === 'add' || command === 'remind') {
    if ((!options.at && !options.in && !options['run-at']) || (!options.message && !options.payload)) {
      throw new Error('add requires a time plus --message or --payload');
    }
    addReminder(options);
    return;
  }
  if (command === 'list') {
    listReminders(options);
    return;
  }
  if (command === 'show') {
    if (!options.id) throw new Error('show requires --id');
    showReminder(options);
    return;
  }
  if (command === 'remove') {
    if (!options.id) throw new Error('remove requires --id');
    removeReminder(options);
    return;
  }
  if (command === 'update') {
    if (!options.id) throw new Error('update requires --id');
    updateReminder(options);
    return;
  }
  if (command === 'run-due') {
    runDue(options);
    return;
  }
  throw new Error(`unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
