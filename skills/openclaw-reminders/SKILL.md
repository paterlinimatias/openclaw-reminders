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
