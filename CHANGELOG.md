# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - TBD

### Added
- Install the bundled `openclaw-reminders` skill into an OpenClaw workspace.
- Create reminders as native OpenClaw one-shot cron jobs.
- List reminder cron jobs in reminder-oriented order.
- Show, update, and remove reminder cron jobs through a reminder-focused CLI.
- Preserve stable delivery routing through native cron fields such as channel, account, and chat destination.

### Changed
- Use native OpenClaw cron as the durable reminder backend instead of maintaining a separate reminder scheduler.
- Simplify setup so the package acts as a skill installer and reminder UX layer.
- Enforce minute-level reminder scheduling semantics to match native cron usage.

### Fixed
- Avoid fragile session-based reminder routing by using stable chat delivery context.
