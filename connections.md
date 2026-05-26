# Connections

Registry of every system your AIOS can reach. Filled by `/onboard` from Q4-Q7 answers; expanded over time as you wire new tools. `/audit` checks this file for domain coverage and freshness.

| # | Domain | Tool | Mechanism | Auth | Last checked |
|---|---|---|---|---|---|
| 1 | Revenue / Financials | Venmo + direct deposit; Notion or spreadsheet (TBD) | not yet connected | — | — |
| 2 | Customer interactions | Gmail, Outlook, LinkedIn DMs | script (gws cli) | OAuth via gws auth login | 2026-05-23 |
| 3 | Calendar | Google Calendar | script (gws cli) | OAuth via gws auth login | 2026-05-23 |
| 4 | Communication | Slack, Teams, iMessage, WhatsApp | not yet connected | — | — |
| 5 | Project / task tracking | Google Calendar + Sheets tracker | script (gws cli) | OAuth via gws auth login | 2026-05-26 |
| 6 | Meeting intelligence | Otter or Fathom (target; currently Teams/Meet built-in) | not yet connected | — | — |
| 7 | Knowledge / files | Google Drive, Docs, Sheets, Slides | script (gws cli) | OAuth via gws auth login | 2026-05-26 |

**Mechanism options:** `mcp` (MCP server), `script` (Python/Bash hitting an API, in `scripts/`), `export` (CSV/JSON dump pipeline), `key+ref` (`.env` key + `references/{tool}-api.md` guide), `not yet connected`.

When you wire a new tool, also save `references/{tool}-api.md` capturing endpoints, auth flow, and common queries — researched-once-saved-forever.
