# openclaw-reminders

openclaw-reminders gives OpenClaw agents a reminder system that survives restarts.

## What it does
It lets agents:
- create reminders on a specific date or in xx minutes, hours, or days from now
- list reminders
- reschedule reminders
- change reminder text
- remove reminders

## Install
```bash
npm install -g openclaw-reminders
openclaw-reminders setup
```

If OpenClaw does not pick up the new skill immediately, restart the gateway:
```bash
openclaw gateway restart
```

## Use
After setup, talk to your agents naturally.

Real examples:
- “Remind me to take a break in 20 minutes”
- “Try doing XXXX again in 5 minutes”
- “Scrape the xxxx site again in two hours”
- “Remind CTO agent in 2 hours to review all pending PRs”

## Manage reminders
You can also ask agents to manipulate reminders:
- “List my reminders”
- “Show me that reminder”
- “Move that reminder to 3 PM”
- “Change that reminder to tomorrow morning”
- “Delete that reminder”

## How this works
Setup will:
- find or ask for your OpenClaw workspace
- create the reminder database
- install the runner cron job
- install the bundled OpenClaw skill

## More docs
- [CLI reference](docs/cli.md)
- [Architecture](docs/architecture.md)
