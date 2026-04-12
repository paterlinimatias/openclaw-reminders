# openclaw-reminders - next improvement spec

## Goal
Make reminder listing and management safer, faster, and easier for both humans and agents.

## Problems to solve
1. `list` can hang too long when `openclaw cron list --json` is slow.
2. Default listing scope is too broad and can surface reminders from other agent accounts/chats.
3. Output is too raw for humans and not clearly split between human vs machine modes.

## Requirements

### 1. Hard timeout for underlying OpenClaw cron calls
Apply a hard timeout wrapper around the `openclaw` subprocess used by:
- `list`
- `show`
- `update`
- `remove`
- any helper path that enumerates cron jobs

Behavior:
- fail fast with a clear error if the subprocess exceeds the timeout
- recommended default timeout: 10s to 15s
- error text should be human-readable, for example:
  - `Timed out while reading OpenClaw cron jobs. The gateway may be slow or unavailable.`

### 2. Default scope = current delivery context
By default, reminder discovery should be scoped to the same delivery context where the command is being used.

Context fields:
- `channel`
- `account`
- `to`

Default behavior:
- `list` should only show reminders whose delivery target matches the current context
- `show`, `update`, and `remove` should only operate on reminders in current scope by default

Override:
- add `--all` to disable context scoping and operate across all reminder jobs managed by this package

Notes:
- this should prevent surfacing reminders from another agent account such as `security`
- context scoping should layer on top of reminder identity filtering, not replace it

### 3. Preserve strict reminder identity filtering
A cron job should only count as a reminder if it matches the reminder job shape.

Current shape:
- `name.startsWith("reminder:")`
- description contains the configured workspace marker
- `sessionTarget === "isolated"`
- `deleteAfterRun === true`
- payload contains a message

Keep this filter, then apply context scoping on top.

### 4. Dual output modes
Support two clear output modes:

#### Default: pretty human output
`list` should render friendly text with:
- id
- reminder text
- human-readable scheduled time
- optional exact scheduled time when useful
- delivery target only when relevant

Examples:
- `in 2 minutes`
- `today at 4:30 PM`
- `tomorrow at 9:00 AM`

Empty state:
- `No reminders scheduled for this chat.`

#### Explicit machine mode
- `--json` should return structured output suitable for agents and automation
- JSON should preserve exact fields like raw `run_at`

### 5. Stable sorted list formatting
For pretty output:
- sort reminders by scheduled time ascending
- use stable columns/rows
- truncate long reminder text cleanly
- avoid raw unformatted object dumps

### 6. Explicit cross-context controls
Implement:
- `--all`

Possible future extension, not required now:
- `--channel <channel>`
- `--account <account>`
- `--to <destination>`

## Tests to add
- `list` filters to current context by default
- `list --all` returns reminder jobs across contexts
- timeout in `openclaw cron list --json` returns a clear timeout error
- pretty output is sorted and stable
- `--json` preserves structured fields
- empty state message is friendly

## Recommended implementation order
1. subprocess timeout wrapper
2. default context filtering
3. pretty output + `--json`
4. tests
5. README / SKILL updates
