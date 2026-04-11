# CLI Reference

This page is for operators and advanced users.

For the simple overview, go back to the [README](../README.md).

## Main flow
Most users should do only this:

```bash
npm install -g openclaw-reminders
openclaw-reminders setup
```

After that, use agents normally and let them manage reminders.

Natural-language examples:
- “Remind me tomorrow at 9 to check deploys”
- “List my reminders”
- “Move that reminder to 3 PM”
- “Delete that reminder”
- “Try again doing XXXX in 5 minutes”

## Commands

### `openclaw-reminders setup`
Checks OpenClaw, finds or prompts for the workspace, initializes the database, and installs the OpenClaw cron runner.

### `openclaw-reminders add`
Create a reminder manually.

Examples:
```bash
openclaw-reminders add --in +2h --agent cto --message "Check Cloud Build"
openclaw-reminders add --at "2026-04-12T09:00:00Z" --agent product --message "Review onboarding"
```

Supported time flags:
- `--at <ISO timestamp>`
- `--in <+10m|+2h|+1d>`
- `--run-at <ISO timestamp>`

Useful flags:
- `--agent <id>`
- `--creator-agent <id>`
- `--target-agent <id>`
- `--message <text>`
- `--payload <json-or-text>`
- `--kind <openclaw_message|shell>`
- `--workspace <path>`

### `openclaw-reminders remind`
Alias for `add`.

### `openclaw-reminders list`
List reminders in the configured workspace.

### `openclaw-reminders show`
Show one reminder by id.

Example:
```bash
openclaw-reminders show --id 12
```

### `openclaw-reminders update`
Update an existing reminder.

Examples:
```bash
openclaw-reminders update --id 12 --in +2h
openclaw-reminders update --id 12 --message "Check deploy after DNS change"
openclaw-reminders update --id 12 --agent cto
```

Supported update flags:
- `--at <ISO timestamp>`
- `--in <+10m|+2h|+1d>`
- `--run-at <ISO timestamp>`
- `--message <text>`
- `--agent <id>`
- `--target-agent <id>`
- `--payload <json-or-text>`
- `--status <pending|failed|done>`

### `openclaw-reminders remove`
Delete one reminder by id.

Example:
```bash
openclaw-reminders remove --id 12
```

### `openclaw-reminders run-due`
Process due reminders for the configured workspace.

### `openclaw-reminders install-runner`
Create the OpenClaw cron runner again if needed.
