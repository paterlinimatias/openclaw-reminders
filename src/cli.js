#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync, statSync, rmSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync, spawn } from 'node:child_process';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const CONFIG_PATH = join(homedir(), '.openclaw', 'openclaw-reminders.json');
const DEFAULT_WORKSPACE_CANDIDATES = [
  process.env.OPENCLAW_WORKSPACE,
  join(homedir(), '.openclaw', 'workspace'),
].filter(Boolean);
const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(CURRENT_DIR, '..');
const BUNDLED_SKILL_DIR = join(PACKAGE_ROOT, 'skills', 'openclaw-reminders');
const REMINDER_NAME_PREFIX = 'reminder:';
const REMINDER_DESCRIPTION_PREFIX = 'Managed by openclaw-reminders';
const OPENCLAW_TIMEOUT_MS = Number(process.env.OPENCLAW_REMINDERS_TIMEOUT_MS || 15000);
const OPENCLAW_PROGRESS_MESSAGES = [
  [10000, 'Still working on it, OpenClaw is taking its time today...'],
];

function parseTime(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`invalid time: ${value}`);
  }
  return parsed;
}

function toIsoTimestamp(date) {
  return new Date(date).toISOString();
}

function parseDuration(value) {
  const trimmed = value.trim();
  const match = /^\+?(\d+)(s|m|h|d)$/.exec(trimmed);
  if (!match) {
    throw new Error(`invalid relative time: ${value}`);
  }
  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return new Date(Date.now() + amount * multipliers[unit]);
}

function resolveRunAt(options) {
  if (options.at) return toIsoTimestamp(parseTime(options.at));
  if (options.in) return toIsoTimestamp(parseDuration(options.in));
  if (options['run-at']) return toIsoTimestamp(parseTime(options['run-at']));
  throw new Error('missing time: use --at, --in, or --run-at');
}

function toCronAtArgument(options) {
  if (options.at) return toIsoTimestamp(parseTime(options.at));
  if (options['run-at']) return toIsoTimestamp(parseTime(options['run-at']));
  if (options.in) {
    return toIsoTimestamp(parseDuration(options.in));
  }
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

let sharedReadline = null;

function getReadline() {
  if (!sharedReadline) {
    sharedReadline = readline.createInterface({ input: process.stdin, output: process.stdout });
  }
  return sharedReadline;
}

function closeReadline() {
  if (sharedReadline) {
    sharedReadline.close();
    sharedReadline = null;
  }
}

function prompt(question) {
  return new Promise((resolvePromise) => {
    const rl = getReadline();
    rl.question(question, (answer) => {
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

function parseJsonOutput(text, fallbackMessage) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error(fallbackMessage);
  return JSON.parse(trimmed);
}

async function runOpenClaw(args, fallbackMessage, options = {}) {
  const timeoutMs = Number(options.timeoutMs || OPENCLAW_TIMEOUT_MS);
  const progressMessages = options.progressMessages === false ? [] : OPENCLAW_PROGRESS_MESSAGES;
  return await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn('openclaw', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timeoutTimer = null;
    const timers = [];

    const cleanup = () => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      timeoutTimer = null;
      for (const timer of timers) clearTimeout(timer);
      timers.length = 0;
    };

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn(value);
    };

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      finish(rejectPromise, error);
    });
    child.on('close', (code, signal) => {
      if (signal === 'SIGTERM') {
        finish(rejectPromise, new Error('Timed out while talking to OpenClaw. The gateway may be slow or unavailable.'));
        return;
      }
      if (code !== 0) {
        finish(rejectPromise, new Error((stderr || stdout || fallbackMessage).trim()));
        return;
      }
      finish(resolvePromise, { status: code, stdout, stderr });
    });

    for (const [delay, message] of progressMessages) {
      if (delay >= timeoutMs) continue;
      timers.push(setTimeout(() => {
        if (settled) return;
        process.stderr.write(`${message}\n`);
      }, delay));
    }

    timeoutTimer = setTimeout(() => {
      if (settled) return;
      child.kill('SIGTERM');
    }, timeoutMs);
  });
}

async function listCronJobs(options = {}) {
  const result = await runOpenClaw(
    ['cron', 'list', '--json'],
    'failed to list OpenClaw cron jobs',
    { progressMessages: options.progressMessages }
  );
  const parsed = parseJsonOutput(result.stdout, 'failed to parse OpenClaw cron list output');
  return parsed.jobs || [];
}

function getCurrentContext(options = {}) {
  return {
    channel: options.channel || process.env.OPENCLAW_REMINDERS_CHANNEL || null,
    account: options.account || process.env.OPENCLAW_REMINDERS_ACCOUNT || null,
    to: options.to || process.env.OPENCLAW_REMINDERS_TO || null,
  };
}

function matchesReminderShape(job, workspace) {
  const name = job.name || '';
  const description = job.description || '';
  return (
    name.startsWith(REMINDER_NAME_PREFIX)
    && description.includes(workspace)
    && job.payload?.message
    && job.sessionTarget === 'isolated'
    && job.deleteAfterRun === true
  );
}

function matchesContext(job, context) {
  if (!context.channel && !context.account && !context.to) return true;
  if (context.channel && job.delivery?.channel !== context.channel) return false;
  if (context.account && job.delivery?.accountId !== context.account) return false;
  if (context.to && job.delivery?.to !== context.to) return false;
  return true;
}

async function getReminderJobs(options = {}) {
  const workspace = getWorkspace(options);
  const context = getCurrentContext(options);
  const jobs = await listCronJobs(options);
  return jobs.filter((job) => {
    if (!matchesReminderShape(job, workspace)) return false;
    if (options.all) return true;
    return matchesContext(job, context);
  });
}

async function removeCronJob(id) {
  const result = await runOpenClaw(['cron', 'rm', id, '--json'], `failed to remove cron job ${id}`);
  return parseJsonOutput(result.stdout, `failed to parse cron remove output for ${id}`);
}

function slugifyReminderText(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'reminder';
}

function buildReminderName(text, atValue) {
  const slug = slugifyReminderText(text);
  const safeTimestamp = String(atValue).replace(/:/g, '-');
  return `${REMINDER_NAME_PREFIX}${slug}:${safeTimestamp}`;
}

function buildReminderDescription(workspace) {
  return `${REMINDER_DESCRIPTION_PREFIX} for ${workspace}`;
}

function formatReminderRow(job) {
  return {
    id: job.id,
    text: job.payload?.message || '',
    run_at: job.schedule?.at || null,
    channel: job.delivery?.channel || null,
    account: job.delivery?.accountId || null,
    to: job.delivery?.to || null,
    name: job.name,
    description: job.description,
  };
}

function pluralize(value, singular) {
  return `${value} ${singular}${value === 1 ? '' : 's'}`;
}

function formatDurationFromNow(runAt) {
  if (!runAt) return 'unknown time';
  const date = new Date(runAt);
  if (Number.isNaN(date.getTime())) return runAt;
  const diffMs = date.getTime() - Date.now();
  const clampedMs = Math.max(0, diffMs);
  const totalSeconds = Math.ceil(clampedMs / 1000);

  if (totalSeconds < 60) {
    return `in ${pluralize(Math.max(1, totalSeconds), 'second')}`;
  }

  const totalMinutes = Math.ceil(clampedMs / 60000);
  if (totalMinutes < 60) {
    return `in ${pluralize(totalMinutes, 'minute')}`;
  }

  if (clampedMs < 7200000) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (minutes > 0) {
      return `in ${pluralize(Math.max(1, hours), 'hour')} and ${pluralize(minutes, 'minute')}`;
    }
    return `in ${pluralize(Math.max(1, hours), 'hour')}`;
  }

  if (clampedMs < 86400000) {
    const totalHours = Math.ceil(clampedMs / 3600000);
    return `in ${pluralize(totalHours, 'hour')}`;
  }

  const totalDays = Math.ceil(clampedMs / 86400000);
  return `in ${pluralize(totalDays, 'day')}`;
}

function emojiForReminder(text) {
  const value = String(text || '').toLowerCase();
  const rules = [
    [/\b(kiss|wife|girlfriend|boyfriend|partner|love|romantic|date)\b/, '💋'],
    [/\b(tooth|teeth|brush|dentist|floss)\b/, '🪥'],
    [/\b(sleep|bed|nap)\b/, '😴'],
    [/\b(call|phone|ring)\b/, '📞'],
    [/\b(meeting|calendar|appointment)\b/, '📅'],
    [/\b(pay|bill|invoice|rent)\b/, '💸'],
    [/\b(med|medicine|medication|pill)\b/, '💊'],
    [/\b(eat|lunch|dinner|breakfast|meal)\b/, '🍽️'],
    [/\b(water|drink)\b/, '💧'],
    [/\b(workout|gym|run|exercise|walk)\b/, '💪'],
  ];
  for (const [pattern, emoji] of rules) {
    if (pattern.test(value)) return emoji;
  }
  return '⏰';
}

function truncate(text, max = 48) {
  const value = String(text || '');
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function printReminderList(rows, options = {}) {
  if (options.json) {
    console.log(JSON.stringify({ ok: true, reminders: rows }));
    return;
  }
  if (!rows.length) {
    console.log(options.all ? 'No reminders scheduled.' : 'No reminders scheduled for this chat.');
    return;
  }
  console.log('These are your upcoming reminders ⏰:');
  for (const row of rows) {
    const when = formatDurationFromNow(row.run_at);
    const emoji = emojiForReminder(row.text);
    console.log(`${emoji} ${truncate(row.text)} ${when}`);
  }
}

async function findReminderJobOrThrow(id, options = {}) {
  const job = (await getReminderJobs(options)).find((entry) => entry.id === id);
  if (!job) {
    throw new Error(`reminder not found: ${id}`);
  }
  return job;
}

async function confirm(message) {
  const answer = await prompt(`${message} [y/N]: `);
  return ['y', 'yes'].includes(answer.toLowerCase());
}

function removeSkill(options = {}) {
  const workspace = getWorkspace(options);
  const skillDir = join(workspace, 'skills', 'openclaw-reminders');
  if (existsSync(skillDir)) {
    rmSync(skillDir, { recursive: true, force: true });
  }
  return { skill_dir: skillDir, removed: true };
}

function removeConfig() {
  if (existsSync(CONFIG_PATH)) {
    unlinkSync(CONFIG_PATH);
  }
  return { config_path: CONFIG_PATH, removed: true };
}

async function uninstall(options) {
  ensureOpenClawInstalled();
  const workspace = getWorkspace(options);
  const summary = {
    workspace,
    cron_jobs_removed: [],
    skill_removed: null,
    config_removed: null,
  };

  try {
    const proceed = await confirm([
      'This will remove:',
      '- native OpenClaw reminder cron jobs created by openclaw-reminders',
      '- the installed skill',
      '- the openclaw-reminders config file',
      '',
      'Proceed?'
    ].join('\n'));
    if (!proceed) {
      process.stderr.write('Uninstall cancelled.\n');
      return;
    }

    for (const job of await getReminderJobs({ workspace, progressMessages: false })) {
      await removeCronJob(job.id);
      summary.cron_jobs_removed.push(job.id);
    }
    summary.skill_removed = removeSkill({ workspace });
    summary.config_removed = removeConfig();
  } finally {
    closeReadline();
  }

  process.stderr.write(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧹  openclaw-reminders uninstall complete.

Removed from this OpenClaw workspace:
- reminder cron jobs created by openclaw-reminders
- installed skill
- openclaw-reminders config file

The npm package is still installed globally.
To remove it too, run:

       npm uninstall -g openclaw-reminders
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

async function addReminder(options) {
  const workspace = getWorkspace(options);
  const at = toCronAtArgument(options);
  const text = options.message || options.text;
  if (!text) {
    throw new Error('add requires --message');
  }
  const args = [
    'cron', 'add',
    '--name', buildReminderName(text, at),
    '--description', buildReminderDescription(workspace),
    '--agent', options.agent || 'cto',
    '--session', 'isolated',
    '--at', at,
    '--message', text,
    '--announce',
    '--delete-after-run',
    '--json',
  ];
  const channel = options.channel || 'telegram';
  const account = options.account || 'cto';
  const to = options.to;
  if (channel) args.push('--channel', channel);
  if (account) args.push('--account', account);
  if (to) args.push('--to', to);
  const result = await runOpenClaw(args, 'failed to create reminder cron job', { progressMessages: false });
  const job = parseJsonOutput(result.stdout, 'failed to parse reminder creation output');
  console.log(JSON.stringify({ ok: true, reminder: formatReminderRow(job) }));
}

async function listReminders(options) {
  const rows = (await getReminderJobs(options))
    .map(formatReminderRow)
    .sort((a, b) => String(a.run_at || '').localeCompare(String(b.run_at || '')));
  printReminderList(rows, options);
}

async function showReminder(options) {
  const id = options.id;
  if (!id) throw new Error('show requires --id');
  const row = formatReminderRow(await findReminderJobOrThrow(id, options));
  if (options.json) {
    console.log(JSON.stringify(row));
    return;
  }
  console.log(`ID: ${row.id}`);
  console.log(`Text: ${row.text}`);
  console.log(`When: ${formatDurationFromNow(row.run_at)}${row.run_at ? ` (${row.run_at})` : ''}`);
  if (row.channel || row.account || row.to) {
    console.log(`Route: ${row.channel || '-'} / ${row.account || '-'} / ${row.to || '-'}`);
  }
}

async function removeReminder(options) {
  const id = options.id;
  if (!id) throw new Error('remove requires --id');
  await findReminderJobOrThrow(id, options);
  await removeCronJob(id);
  console.log(JSON.stringify({ ok: true, removed: id }));
}

async function updateReminder(options) {
  const id = options.id;
  if (!id) throw new Error('update requires --id');
  const current = await findReminderJobOrThrow(id, options);
  const args = ['cron', 'edit', id];
  if (options.message || options.text) {
    const text = options.message || options.text;
    const atValue = (options.at || options.in || options['run-at']) ? toCronAtArgument(options) : (current.schedule?.at || 'unknown-time');
    args.push('--message', text, '--name', buildReminderName(text, atValue));
  }
  if (options.at || options.in || options['run-at']) {
    const nextAt = toCronAtArgument(options);
    args.push('--at', nextAt);
    if (!(options.message || options.text)) {
      args.push('--name', buildReminderName(current.payload?.message || 'reminder', nextAt));
    }
  }
  if (options.channel) args.push('--channel', options.channel);
  if (options.account) args.push('--account', options.account);
  if (options.to) args.push('--to', options.to);
  args.push('--announce', '--json');
  const result = await runOpenClaw(args, `failed to update reminder ${id}`, { progressMessages: false });
  const updated = parseJsonOutput(result.stdout, `failed to parse reminder update output for ${id}`);
  const normalized = formatReminderRow(updated);
  if (!normalized.description) {
    normalized.description = current.description;
  }
  console.log(JSON.stringify({ ok: true, reminder: normalized }));
}

async function setup(options) {
  ensureOpenClawInstalled();
  const workspace = options.workspace ? resolve(options.workspace) : await ensureWorkspaceInteractive();
  const config = { workspace };
  saveConfig(config);
  const skill = installSkill({ workspace });
  const result = { ok: true, workspace, skill };
  if (options.json) {
    console.log(JSON.stringify(result));
    return;
  }
  process.stdout.write(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅  Setup complete!

Workspace:
   ${workspace}

This package now installs the reminder skill.
Scheduling uses native OpenClaw cron jobs.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

function printHelp() {
  console.log(`openclaw-reminders

Setup once:
  openclaw-reminders setup

Cron-native reminder commands:
  add --in <2m> --message <text> [--channel <channel>] [--account <id>] [--to <dest>]
  list [--json] [--all] [--channel <channel>] [--account <id>] [--to <dest>]
  show --id <cron-job-id> [--json]
  update --id <cron-job-id> [--in <5m> | --at <ISO>] [--message <text>] [--channel <channel>] [--account <id>] [--to <dest>]
  remove --id <cron-job-id>
  install-skill
  uninstall`);
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
  if (command === 'install-skill') {
    const skill = installSkill(options);
    console.log(JSON.stringify({ ok: true, skill }));
    return;
  }
  if (command === 'uninstall') {
    await uninstall(options);
    return;
  }
  if (command === 'add' || command === 'remind') {
    await addReminder(options);
    return;
  }
  if (command === 'list') {
    await listReminders(options);
    return;
  }
  if (command === 'show') {
    await showReminder(options);
    return;
  }
  if (command === 'remove') {
    await removeReminder(options);
    return;
  }
  if (command === 'update') {
    await updateReminder(options);
    return;
  }
  throw new Error(`unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
