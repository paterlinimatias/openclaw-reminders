# openclaw-reminders

openclaw-reminders gives OpenClaw agents a reminder system that survives restarts.

## How it works
After setup, talk to your agents naturally:
- “Remind me to take a break in 20 minutes”
- “Try doing XXXX again in 5 minutes”
- “Scrape the xxxx site again in two hours”
- “Remind CTO agent in 2 hours to review all pending PRs”
- “List my reminders”
- “Move that reminder to 3 PM”
- “Change that reminder to tomorrow morning”
- “Delete that reminder”

## Install
```bash
npm install -g openclaw-reminders
openclaw-reminders setup
```

If OpenClaw does not pick up the new skill immediately, restart the gateway:
```bash
openclaw gateway restart
```

## What setup does
Setup will:
- find or ask for your OpenClaw workspace
- create the reminder database
- install the runner cron job
- install the bundled OpenClaw skill

## Uninstall
```bash
openclaw-reminders uninstall
npm uninstall -g openclaw-reminders
```

## More docs
- [CLI reference](docs/cli.md)
- [Architecture](docs/architecture.md)
