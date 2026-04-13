# openclaw-reminders

`openclaw-reminders` is a chat-first reminder installer + CLI for OpenClaw.

The idea is simple: the user talks to the agent in their normal channel, the agent turns that into an `openclaw-reminders` command, and the reminder comes back to that same chat later.

It does **not** run its own scheduler.
It installs a reminder skill and stores reminders directly as native OpenClaw cron jobs.

## Install

```bash
npm install -g openclaw-reminders
openclaw-reminders setup
```

## What users do

Users should stay in chat. They do **not** need to learn cron.

Examples of user messages:
- "Remind me in 20 minutes to check the oven"
- "Tomorrow at 9am remind me to call my mom"
- "What reminders do I have?"
- "Move that reminder to tonight at 8"
- "Delete the reminder about the dentist"

## What the agent does

The agent should translate the request into the CLI, using the current routing context whenever possible.

Examples:

```bash
openclaw-reminders add --in 20m --message "check the oven" --channel telegram --account cto --to 8020357623
openclaw-reminders list
openclaw-reminders update --id <cron-job-id> --at 2026-04-13T20:00:00.000Z
openclaw-reminders remove --id <cron-job-id>
```

## How the agent should reply

Keep reminder creation replies tiny and consistent.

Recommended pattern:
- immediately: `⚙️ Setting up reminder...`
- if still waiting after 10 seconds: `⏳ Still working on it...`
- after success: `⏳ Reminder set to <reminder> in <how long from now>.`
- when it later fires: `⏰ Reminder: <reminder message> <relevant emoji>`

Rules:
- the first real action should be the CLI command, not a success reply
- wait up to 2 minutes for the CLI to finish
- send the setup message immediately when the request is received
- send at most one slow-progress message after 10 seconds of real waiting
- only confirm success after the CLI actually succeeds
- if the CLI fails or times out, say that clearly
- never combine a success confirmation with a failure/disclaimer in the same turn
- never simulate the later reminder-delivery message during the creation turn
- avoid dumping raw JSON into chat unless the user explicitly asked for machine-readable output

## CLI capabilities

- installs the `openclaw-reminders` skill into the OpenClaw workspace
- creates reminders as native OpenClaw one-shot cron jobs
- identifies reminder jobs with a structured `reminder:<slug>:<timestamp>` name prefix
- lists reminders in the current chat/account by default, with `--all` to widen scope
- supports human-friendly output by default and `--json` for agents/automation
- shows, updates, and removes reminder cron jobs

## Commands

```bash
openclaw-reminders add --in 2m --message "brush teeth" --channel telegram --account cto --to 8020357623
openclaw-reminders list
openclaw-reminders list --json
openclaw-reminders list --all
openclaw-reminders show --id <cron-job-id>
openclaw-reminders update --id <cron-job-id> --in 10m --message "call bibi"
openclaw-reminders remove --id <cron-job-id>
openclaw-reminders uninstall
```

## Notes

- Reminder scheduling is backed by native OpenClaw cron.
- Reminders can use exact timestamps, including seconds, because native OpenClaw cron accepts one-shot ISO times.
- Relative reminder times support `s`, `m`, `h`, and `d`, for example `23s`, `2m`, `10m`, `1h`, or `1d`.
- Delivery should preserve the original chat routing context whenever possible.
- Reminder jobs are filtered by a structured `reminder:` name prefix plus reminder-specific cron properties.
- When routing context is available, listing defaults to the current `channel` / `account` / `to` scope.
