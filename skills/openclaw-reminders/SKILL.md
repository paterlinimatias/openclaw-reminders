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

Preferred reply shapes after successful CLI completion:
- "Done, I’ll remind you in 20 minutes."
- "Done, I’ll remind you tomorrow at 9:00 AM."
- "You have 3 reminders in this chat."
- "I moved it to Friday at 4:00 PM."
- "Removed that reminder."

When listing reminders, prefer lines like:
- "Check the oven, in 20 minutes"
- "Call my mom, tomorrow at 9:00 AM"

Do not dump raw JSON into the chat unless the user explicitly asks for JSON or structured output.

## Waiting behavior

Reminder commands may take a while if the OpenClaw cron gateway is slow.

Rules:
- For reminder create, update, remove, list, and show requests, the first real action should be the CLI command, not a user-visible success reply.
- Wait up to 2 minutes for the CLI result before giving up.
- Do not send success wording before the CLI command actually succeeds.
- Do not say "Done, I’ll remind you..." unless the reminder was really scheduled.
- If the command is still running, send short progress updates instead of pretending it finished.
- If the command fails or times out, say that plainly instead of mixing a fake success with a disclaimer.
- Do not invent or simulate the future reminder delivery message in the creation turn.
- Never output lines like `⏰ Reminder: ...` or `🪥 Reminder: ...` while creating the reminder. Those are for the later delivery event only.

Suggested progress messages while waiting:
- "Still working on it, the reminder system is being slow."
- "Still waiting for the reminder to save, I haven’t forgotten."
- "Almost there, OpenClaw is taking longer than usual."

Bad patterns, never do these:
- "🪥 Reminder: brush your teeth."
- "Done, I’ll remind you in 5 minutes."
- "Note: I did not schedule a reminder in this turn..."

The creation turn must never contain both a success confirmation and a failure/disclaimer.

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
- When listing reminders to the user, prefer friendly human output such as `in 23 seconds`, `in 2 minutes`, `today at 4:30 PM`, or `tomorrow at 9:00 AM` instead of raw ISO timestamps unless the user asked for exact timestamps.
