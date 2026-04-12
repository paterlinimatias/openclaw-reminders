# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - TBD

### Added
- Create reminders that run at a specific time or after a relative delay.
- Target reminders to a specific OpenClaw agent.
- Store reminders in a workspace-local SQLite database.
- List, inspect, update, and remove existing reminders.
- Run due reminders and dispatch OpenClaw messages automatically.
- Configure the package interactively with `openclaw-reminders setup`.
- Install the bundled `openclaw-reminders` skill into the OpenClaw workspace.
- Register an OpenClaw cron runner so due reminders are checked automatically.
- Uninstall reminder runtime artifacts with an interactive `openclaw-reminders uninstall` flow.

### Changed
- Use `better-sqlite3` for stable local database access without Node experimental warnings.

### Fixed
- Keep interactive uninstall prompts reliable across multiple confirmations.
