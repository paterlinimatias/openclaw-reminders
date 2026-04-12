---
name: openclaw-reminders
description: Durable reminder management for OpenClaw backed by a workspace SQLite database. Use when the user wants to create a reminder, list reminders, inspect one reminder, reschedule it, edit its text, change the target agent, or remove a reminder.
---

# openclaw-reminders

Use the `openclaw-reminders` CLI for all durable reminder work.

## Commands

Create a reminder:
```bash
openclaw-reminders add --in +2h --agent cto --message "Check deploy"
```

List reminders:
```bash
openclaw-reminders list
```

Show one reminder:
```bash
openclaw-reminders show --id 12
```

Reschedule or edit a reminder:
```bash
openclaw-reminders update --id 12 --in +3h
openclaw-reminders update --id 12 --message "Check deploy after DNS change"
openclaw-reminders update --id 12 --agent product
```

Remove a reminder:
```bash
openclaw-reminders remove --id 12
```

Run due reminders:
```bash
openclaw-reminders run-due
```

## Guidance
- Prefer this skill when the user wants a reminder that survives restarts.
- Use natural language with the user, but execute exact CLI commands.
- Use `list` before modifying or deleting if the reminder id is unclear.
- After updating or removing a reminder, confirm the result clearly.
- When a reminder is created from a user conversation, preserve the original delivery context whenever possible.
- When the reminder fires, notify the user in the same chat/channel where the reminder request was originally made.
- Use stable routing context such as channel/account/chat identity, not a fragile session key that may change after `/new`.
- The reminder message should clearly say either:
  - what the user asked to be reminded about, or
  - that the previously scheduled reminder is now being executed.
- Do not silently reroute reminder notifications to a different channel unless the user explicitly asked for that.
- The minimum reminder time unit is **one minute**.
- Accept examples like:
  - in 1 minute
  - in 20 minutes
  - on a specific date at a specific hour
- Do **not** create reminders for sub-minute timing such as:
  - in 10 seconds
  - in 30 seconds
- Do **not** keep fractional minute precision such as:
  - in 1.5 minutes
  - in 2.7 minutes
- When the user gives a fractional number of minutes, round **down** to the nearest whole minute before scheduling.
- This rule exists because the reminder runner executes once per minute, so reminder scheduling should match that cadence.
