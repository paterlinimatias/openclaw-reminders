# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Lower the default OpenClaw cron timeout to 15 seconds so reminder discovery fails fast instead of hanging for up to a minute.
- Limit reminder CLI slow-progress output to a single 10-second message, matching the chat UX contract.
- Tighten relative time formatting so reminders between 1 and 2 hours show `hours and minutes`, while longer same-day reminders show rounded hours only.

### Fixed
- Keep README and bundled skill guidance aligned with the current timeout and listing behavior.

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
