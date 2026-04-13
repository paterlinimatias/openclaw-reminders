# openclaw-reminders - next improvement spec

## Goal
Make reminder listing, delivery, and follow-through safer, faster, and easier for both humans and agents.

## Problems to solve
1. `list` can hang too long when `openclaw cron list --json` is slow.
2. Default listing scope is too broad and can surface reminders from other agent accounts/chats.
3. Output is too raw for humans and not clearly split between human vs machine modes.
4. Human list output still exposes internal ids and sometimes uses less useful absolute times.
5. Fired reminders do not yet clearly distinguish user-directed reminders from agent-directed reminders.

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
- a leading calendar emoji
- reminder text
- human-readable scheduled time relative to now when possible
- no internal id by default
- delivery target only when relevant

Examples:
- `📅 Go to sleep, in 2 minutes`
- `📅 Kiss my wife, in 3 hours`
- `📅 Dentist appointment, tomorrow at 9:00 AM`

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

## Reminder delivery semantics

### User-directed reminders
If the reminder is for the user, the fired message should tell the user what they need to do.

Examples:
- `⏰ Reminder: Go to sleep 😴`
- `⏰ Reminder: Kiss your wife 💋`

### Agent-directed reminders
If the reminder is for the agent, the fired message should make the agent action explicit, and the agent should follow through when the reminder fires.

Examples:
- `⏰ Reminder: I need to check the deploy status 🚀`
- `⏰ Reminder: I need to review the inbox 📬`

Open question to resolve in implementation:
- how to mark a reminder as agent-directed vs user-directed without brittle guessing
- likely options are explicit metadata, explicit phrasing rules, or a future CLI flag

## Tests to add
- `list` filters to current context by default
- `list --all` returns reminder jobs across contexts
- timeout in `openclaw cron list --json` returns a clear timeout error
- pretty output is sorted and stable
- pretty output omits ids by default
- pretty output uses relative time from now when possible
- `--json` preserves structured fields
- empty state message is friendly

## Recommended implementation order
1. subprocess timeout wrapper
2. default context filtering
3. pretty output + `--json`
4. tests
5. README / SKILL updates
