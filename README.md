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

## Troubleshooting

### Why do I see this warning during npm install?

You may see this during installation:

```text
npm warn deprecated prebuild-install@7.1.3: No longer maintained. Please contact the author of the relevant native addon; alternatives are available.
```

This warning does **not** come from `openclaw-reminders` directly. It comes from a transitive dependency in the SQLite stack used by `better-sqlite3`.

A few important notes:
- `better-sqlite3` is a widely used and well-maintained SQLite library for Node.js.
- SQLite itself is a mature, well-maintained, and widely trusted embedded database.
- The warning is about an install-time helper dependency, not about your reminder data being unsafe or unsupported.
- The `better-sqlite3` maintainers are already tracking/discussing this here:
  - <https://github.com/WiseLibs/better-sqlite3/issues/1463>

If you see this warning, installation can still complete successfully and `openclaw-reminders` should continue to work normally.

## More docs
- [CLI reference](docs/cli.md)
- [Architecture](docs/architecture.md)
