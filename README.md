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

Keep replies short, natural, and confirmation-first.

Good reply shapes:
- "Done, I’ll remind you in 20 minutes."
- "Done, I’ll remind you tomorrow at 9:00 AM."
- "You’ve got 2 reminders in this chat."
- "I moved it to tonight at 8:00 PM."
- "Removed that reminder."

When listing reminders, prefer human-friendly text, for example:
- "Dentist appointment, tomorrow at 3:00 PM"
- "Call mom, in 20 minutes"

Avoid dumping raw JSON into chat unless the user explicitly asked for machine-readable output.

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
- Minimum reminder granularity is one minute.
- Relative reminder times use minute-or-larger values such as `2m`, `10m`, `1h`, or `1d`.
- Delivery should preserve the original chat routing context whenever possible.
- Reminder jobs are filtered by a structured `reminder:` name prefix plus reminder-specific cron properties.
- When routing context is available, listing defaults to the current `channel` / `account` / `to` scope.
