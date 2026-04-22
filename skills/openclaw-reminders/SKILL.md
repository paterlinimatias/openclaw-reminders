---
name: openclaw-reminders
description: Cron-native reminder management for OpenClaw. Use when the user wants to create a reminder, list reminders, inspect one reminder, reschedule it, edit its text, or remove a reminder. This skill uses native OpenClaw cron jobs as the durable backend.
---

# openclaw-reminders

Use the `openclaw-reminders` CLI for reminder work. It is a thin reminder UX layer on top of native OpenClaw cron.

The user stays in chat and speaks naturally. The agent converts that into an exact CLI command, waits for the result, then replies with a very small fixed pattern.

## Response pattern

For reminder creation, keep replies simple and consistent.

When the instruction is received:
- send `⚙️ Setting up reminder...` immediately in chat, before any CLI or cron call starts

If it is still waiting after 10 seconds:
- `👀 Still working on it...`

After successful scheduling:
- `⏰ Reminder set to <reminder> in <how long from now> <relevant emoji>.`

When the reminder actually fires later:
- `⏰ Reminder: <reminder message> <relevant emoji>`

For reminder lists:
- header: `These are your upcoming reminders ⏰:`
- rows: `<relevant emoji> <reminder> <relative time>`

## Rules

- The first user-visible action must be the setup message in chat: `⚙️ Setting up reminder...`.
- Send that setup message immediately after reminder intent is recognized, before any CLI or cron call starts.
- The first tool action must then be the CLI command, not a success reply.
- Wait up to 2 minutes for the CLI result before giving up.
- Expect the CLI itself to fail fast for cron lookups in about 15 seconds if OpenClaw is slow or unavailable.
- Send the setup message immediately when the reminder request is received.
- Send at most one slow-progress message, after 10 seconds of real waiting.
- Only send the success message after the CLI command actually succeeds.
- If the CLI fails or times out, say that plainly.
- Never combine a success confirmation with a failure/disclaimer in the same turn.
- Never simulate the later fired reminder message during the creation turn.
- Do not dump raw JSON into normal chat replies.

## Chat examples

User says:
- "Remind me in 20 minutes to check the oven"
- "Tomorrow at 9 remind me to call my mom"
- "What reminders do I have?"
- "Move my reminder about the dentist to Friday at 4"
- "Delete the reminder to pay rent"

Agent runs commands like:

```bash
openclaw-reminders add --in 20m --message "check the oven" --channel telegram --account cto --to 8020357623
openclaw-reminders list
openclaw-reminders update --id <cron-job-id> --at 2026-04-18T16:00:00.000Z
openclaw-reminders remove --id <cron-job-id>
```

## Commands

Create a reminder:
```bash
openclaw-reminders add --in 2h --message "Check deploy" --channel telegram --account cto --to 8020357623
```

List reminders:
```bash
openclaw-reminders list
openclaw-reminders list --all
openclaw-reminders list --json
```

Show one reminder:
```bash
openclaw-reminders show --id <cron-job-id>
```

Reschedule or edit a reminder:
```bash
openclaw-reminders update --id <cron-job-id> --in 3h
openclaw-reminders update --id <cron-job-id> --message "Check deploy after DNS change"
```

Remove a reminder:
```bash
openclaw-reminders remove --id <cron-job-id>
```

## Guidance
- Prefer this skill when the user wants a reminder that survives restarts.
- Use natural language with the user, but execute exact CLI commands.
- Use native OpenClaw cron as the durable source of truth. Do not create a second scheduler.
- Reminder cron jobs should use a structured name like `reminder:<short-slug>:<timestamp>` so they can be identified reliably without native tag support.
- Use `list` before modifying or deleting if the reminder id is unclear.
- By default, `list` should stay scoped to the current chat routing context when possible. Use `--all` only when the user really wants reminders across contexts.
- Prefer default human-readable list output in conversation. Use `--json` only for automation or structured follow-up work.
- After updating or removing a reminder, confirm the result clearly in normal chat language.
- Preserve the original delivery context whenever possible.
- When the reminder fires, notify the user in the same chat/channel where the reminder request was originally made.
- Use stable routing context such as channel, account, and chat identity. Do not depend on a fragile session key that may change after `/new`.
- Do not silently reroute reminder notifications to a different channel unless the user explicitly asked for that.
- Native OpenClaw cron accepts exact one-shot ISO timestamps, including seconds.
- Accept examples like:
  - in 23 seconds
  - in 1 minute
  - in 20 minutes
  - on a specific date at a specific hour
- Relative reminder times may use seconds, minutes, hours, or days.
- If the user asks for sub-minute timing, honor it instead of rounding up.
- Use exact timestamps when needed so reminders can fire at second-level precision.
- When listing reminders to the user, prefer friendly human output such as `in 23 seconds`, `in 14 minutes`, `in 1 hour and 12 minutes`, `in 3 hours`, or `in 2 days` instead of raw ISO timestamps unless the user asked for exact timestamps.
- Relative time style for chat:
  - under 1 minute: seconds
  - under 1 hour: minutes
  - over 1 hour and under 2 hours: hours and minutes
  - 2 hours up to 24 hours: hours only
  - 24 hours or more: days from now
