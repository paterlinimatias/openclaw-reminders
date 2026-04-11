# openclaw-reminders

Durable reminders for OpenClaw.

## What it does
`openclaw-reminders` gives OpenClaw agents a reminder system that survives restarts.

It lets agents:
- create reminders
- list reminders
- inspect one reminder
- reschedule reminders
- change reminder text
- remove reminders

## Install
```bash
npm install -g openclaw-reminders
openclaw-reminders setup
```

Setup will:
- find or ask for your OpenClaw workspace
- create the reminder database
- install the runner cron job
- install the bundled OpenClaw skill

If OpenClaw does not pick up the new skill immediately, restart the gateway:
```bash
openclaw gateway restart
```

## Use
After setup, talk to your agents naturally.

Examples:
- “Remind me tomorrow at 9 to check deploys”
- “List my reminders”
- “Move that reminder to 3 PM”
- “Delete that reminder”
- “Try again doing XXXX in 5 minutes”
- “Remind CTO in 2 hours to review the PR”

## More docs
- [CLI reference](docs/cli.md)
- [Architecture](docs/architecture.md)
