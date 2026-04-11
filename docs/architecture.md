# Architecture

This page is for implementation details.

For installation and day-to-day usage, start with the [README](../README.md).
## Storage model
- single SQLite database
- scoped to one configured OpenClaw workspace
- database path:
  - `<workspace>/.openclaw-reminders/reminders.db`

## Why workspace-scoped storage
- keeps reminders with the OpenClaw workspace they belong to
- avoids storing state in npm global install directories
- makes migration and backups straightforward

## Reminder ownership
Each reminder stores:
- `workspace_path`
- `creator_agent_id`
- `target_agent_id`
- `run_at`
- `kind`
- `payload`
- `status`
- timestamps / attempts / last_error

Default behavior:
- target agent defaults to creator agent

## Execution flow
1. agent or operator creates reminder
2. reminder is stored in workspace DB
3. OpenClaw cron runner wakes periodically
4. `run-due` finds due reminders
5. reminder is routed back to the target agent via OpenClaw

## Setup flow
1. verify `openclaw` CLI exists
2. discover default workspace or prompt user for path
3. save config in `~/.openclaw/openclaw-reminders.json`
4. initialize database in workspace
5. install OpenClaw cron runner
