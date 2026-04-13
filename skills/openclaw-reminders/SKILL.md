---
name: openclaw-reminders
description: Cron-native reminder management for OpenClaw. Use when the user wants to create a reminder, list reminders, inspect one reminder, reschedule it, edit its text, or remove a reminder. This skill uses native OpenClaw cron jobs as the durable backend.
---

# openclaw-reminders

Use the `openclaw-reminders` CLI for reminder work. It is a thin reminder UX layer on top of native OpenClaw cron.

The user should stay in chat and speak naturally. The agent should convert that into exact CLI commands, then answer back in short, human language.

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

## Reply style

The agent should reply in a way that sounds like a normal assistant in chat.

Preferred reply shapes:
- "Done, I’ll remind you in 20 minutes."
- "Done, I’ll remind you tomorrow at 9:00 AM."
- "You have 3 reminders in this chat."
- "I moved it to Friday at 4:00 PM."
- "Removed that reminder."

When listing reminders, prefer lines like:
- "Check the oven, in 20 minutes"
- "Call my mom, tomorrow at 9:00 AM"

Do not dump raw JSON into the chat unless the user explicitly asks for JSON or structured output.

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
- The minimum reminder time unit is **one minute**.
- Accept examples like:
  - in 1 minute
  - in 20 minutes
  - on a specific date at a specific hour
- Do **not** create reminders for sub-minute timing such as:
  - in 10 seconds
  - in 30 seconds
- Do **not** keep fractional-minute precision.
- When the user gives a fractional number of minutes, round **down** to the nearest whole minute before scheduling.
- Native OpenClaw cron accepts `10m` or an ISO timestamp for one-shot runs. If the user says `in 10 minutes`, map that to `--in 10m` semantics in the CLI.
- When listing reminders to the user, prefer friendly human output such as `in 2 minutes`, `today at 4:30 PM`, or `tomorrow at 9:00 AM` instead of raw ISO timestamps unless the user asked for exact timestamps.
