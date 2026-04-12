# openclaw-reminders

`openclaw-reminders` is a small installer + CLI for cron-native reminders in OpenClaw.

It does **not** run its own scheduler anymore.
It installs the reminder skill and provides a reminder-focused CLI that stores reminders directly as native OpenClaw cron jobs.

## Install

```bash
npm install -g openclaw-reminders
openclaw-reminders setup
```

## What it does

- installs the `openclaw-reminders` skill into your OpenClaw workspace
- creates reminders as native OpenClaw one-shot cron jobs
- identifies reminder jobs with a structured `reminder:<slug>:<timestamp>` name prefix
- lists reminder cron jobs in reminder-oriented form
- updates reminder cron jobs
- removes reminder cron jobs

## Commands

```bash
openclaw-reminders add --in 2m --message "brush teeth" --channel telegram --account cto --to 8020357623
openclaw-reminders list
openclaw-reminders show --id <cron-job-id>
openclaw-reminders update --id <cron-job-id> --in 10m --message "call bibi"
openclaw-reminders remove --id <cron-job-id>
openclaw-reminders uninstall
```

## Notes

- Reminder scheduling is backed by native OpenClaw cron.
- Minimum reminder granularity is one minute.
- Relative reminder times use minute-or-larger values such as `2m`, `10m`, `1h`, or `1d`.
- Delivery should preserve the original chat routing context whenever possible.
- Reminder jobs are filtered by a structured `reminder:` name prefix plus reminder-specific cron properties.
