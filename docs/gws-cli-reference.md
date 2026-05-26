# GWS CLI Reference Guide

**Version:** 0.22.5  
**Install:** `npm install -g @googleworkspace/cli`  
**Auth config:** `~/.config/gws/client_secret.json`  
**Auth:** `gws auth login`

GWS CLI is built dynamically from Google's Discovery Service — it automatically supports new API endpoints as Google adds them. All commands share global flags.

---

## Global Flags

| Flag | Purpose |
|---|---|
| `--format <FORMAT>` | Output as `json` (default), `table`, `yaml`, or `csv` |
| `--dry-run` | Preview the request without executing it |
| `--page-all` | Auto-paginate all results as NDJSON (one JSON object per line) |
| `--page-limit <N>` | Max pages when using `--page-all` (default: 10) |
| `--page-delay <MS>` | Delay between pages in ms (default: 100) |
| `--sanitize <TEMPLATE>` | Run responses through Google Cloud Model Armor |

---

## PowerShell / Windows Note

**Always use Bash (not PowerShell) when passing `--params` JSON.** PowerShell mangles the JSON quoting and produces `400 Invalid --params JSON` errors. Run scripts via Bash or write params to a variable in a shell script.

```bash
# Correct (Bash)
gws drive files list --params '{"pageSize": 10}'

# Broken (PowerShell) — do not use
gws drive files list --params '{"pageSize": 10}'
```

---

## Gmail

```
gws gmail <command>
```

### Helper Commands

| Command | Purpose |
|---|---|
| `gws gmail +triage` | List unread inbox messages as a table |
| `gws gmail +send --to <email> --subject <text> --body <text>` | Send an email |
| `gws gmail +reply --message-id <id> --body <text>` | Reply to a message |
| `gws gmail +watch` | Stream new emails as JSON in real time |

### Raw API Commands

```
gws gmail users messages list --params '{"q": "is:unread", "maxResults": 20}'
gws gmail users messages get --params '{"id": "MSG_ID", "format": "metadata"}'
gws gmail users threads list --params '{"q": "from:recruiter@co.com"}'
gws gmail users threads get --params '{"id": "THREAD_ID"}'
gws gmail users labels list
gws gmail users drafts list
gws gmail users drafts create --json '{"message": {"raw": "BASE64_RFC2822"}}'
```

### Useful Gmail search queries (`q` param)

```
is:unread in:inbox
from:recruiter@company.com
subject:offer newer_than:7d
has:attachment -category:promotions
label:job-search
```

---

## Google Drive

```
gws drive <command>
```

### Helper Commands

| Command | Purpose |
|---|---|
| `gws drive +upload ./file.pdf --name "Report"` | Upload a file to Drive |

### Raw API Commands

```bash
# List files (filter by type)
gws drive files list --params '{"pageSize": 10}'
gws drive files list --params '{"q": "mimeType='\''application/vnd.google-apps.document'\''", "pageSize": 5}'
gws drive files list --params '{"q": "mimeType='\''application/vnd.google-apps.spreadsheet'\''", "pageSize": 5}'

# Get file metadata
gws drive files get --params '{"fileId": "FILE_ID"}'

# Search by name
gws drive files list --params '{"q": "name contains '\''resume'\''", "pageSize": 5}'

# Create folder
gws drive files create --json '{"name": "AIOS", "mimeType": "application/vnd.google-apps.folder"}'

# Trash / delete
gws drive files trash --params '{"fileId": "FILE_ID"}'
gws drive files delete --params '{"fileId": "FILE_ID"}'
```

### Common MIME types

| Type | MIME string |
|---|---|
| Google Doc | `application/vnd.google-apps.document` |
| Google Sheet | `application/vnd.google-apps.spreadsheet` |
| Google Slides | `application/vnd.google-apps.presentation` |
| Google Folder | `application/vnd.google-apps.folder` |
| PDF | `application/pdf` |

---

## Google Calendar

```
gws calendar <command>
```

### Helper Commands

| Command | Purpose |
|---|---|
| `gws calendar +agenda` | Show today's events from all calendars |
| `gws calendar +agenda --timezone America/New_York` | Agenda with timezone override |
| `gws calendar +insert` | Interactive event creation |

### Raw API Commands

```bash
# List events (primary calendar, this week)
gws calendar events list --params '{"calendarId": "primary", "timeMin": "2026-05-26T00:00:00Z", "timeMax": "2026-06-02T00:00:00Z", "singleEvents": true, "orderBy": "startTime"}'

# List all calendars
gws calendar calendarList list

# Get a specific event
gws calendar events get --params '{"calendarId": "primary", "eventId": "EVENT_ID"}'

# Create an event
gws calendar events insert --params '{"calendarId": "primary"}' \
  --json '{"summary": "Title", "start": {"dateTime": "2026-05-27T10:00:00-04:00"}, "end": {"dateTime": "2026-05-27T11:00:00-04:00"}}'

# Delete an event
gws calendar events delete --params '{"calendarId": "primary", "eventId": "EVENT_ID"}'
```

---

## Google Docs

```
gws docs <command>
```

### Helper Commands

| Command | Purpose | Example |
|---|---|---|
| `gws docs +write` | Append plain text to the end of a document | `gws docs +write --document DOC_ID --text 'Hello'` |

### Raw API Commands

```bash
# Get full document content
gws docs documents get --params '{"documentId": "DOC_ID"}'

# Create a blank document
gws docs documents create --json '{"title": "New Doc"}'

# Batch update (insert text, format, etc.)
gws docs documents batchUpdate --params '{"documentId": "DOC_ID"}' \
  --json '{"requests": [{"insertText": {"location": {"index": 1}, "text": "Hello world"}}]}'
```

### Notes

- `documents.get` returns the full JSON document structure including all body content, tables, lists, and inline objects.
- For writing structured content, use `batchUpdate` with request types like `insertText`, `insertTable`, `updateTextStyle`, `createNamedRange`.
- `+write` is a shortcut for appending plain text only — use `batchUpdate` for anything with formatting.
- Document IDs appear in the Drive URL: `docs.google.com/document/d/DOC_ID/edit`

---

## Google Sheets

```
gws sheets <command>
```

### Helper Commands

| Command | Purpose | Example |
|---|---|---|
| `gws sheets +read` | Read a cell range | `gws sheets +read --spreadsheet ID --range 'Sheet1!A1:D10'` |
| `gws sheets +append` | Append a row | `gws sheets +append --spreadsheet ID --values 'Alice,95,true'` |
| `gws sheets +append` (bulk) | Append multiple rows | `gws sheets +append --spreadsheet ID --json-values '[["a","b"],["c","d"]]'` |

### Raw API Commands

```bash
# Get spreadsheet metadata (no cell data)
gws sheets spreadsheets get --params '{"spreadsheetId": "SHEET_ID"}'

# Read a range of values
gws sheets spreadsheets values get \
  --params '{"spreadsheetId": "SHEET_ID", "range": "Sheet1!A1:E10"}'

# Write to a range
gws sheets spreadsheets values update \
  --params '{"spreadsheetId": "SHEET_ID", "range": "Sheet1!A1", "valueInputOption": "USER_ENTERED"}' \
  --json '{"values": [["Name", "Score"], ["Alice", 95]]}'

# Append rows
gws sheets spreadsheets values append \
  --params '{"spreadsheetId": "SHEET_ID", "range": "Sheet1!A1", "valueInputOption": "USER_ENTERED"}' \
  --json '{"values": [["Bob", 88]]}'

# Batch read multiple ranges
gws sheets spreadsheets values batchGet \
  --params '{"spreadsheetId": "SHEET_ID", "ranges": ["Sheet1!A1:B5", "Sheet2!C1:D5"]}'

# Clear a range
gws sheets spreadsheets values clear \
  --params '{"spreadsheetId": "SHEET_ID", "range": "Sheet1!A1:Z100"}'

# Create a new spreadsheet
gws sheets spreadsheets create \
  --json '{"properties": {"title": "My Tracker"}}'
```

### Critical: Quoting ranges with `!`

Bash interprets `!` as history expansion in double quotes. Always use **single quotes** around ranges:

```bash
# Correct
gws sheets +read --spreadsheet ID --range 'Sheet1!A1:D10'

# Broken — bash expands the !
gws sheets +read --spreadsheet ID --range "Sheet1!A1:D10"
```

---

## Google Slides

```
gws slides <command>
```

### Raw API Commands (no helper shortcuts)

```bash
# Get full presentation content
gws slides presentations get --params '{"presentationId": "PRES_ID"}'

# Create a blank presentation
gws slides presentations create \
  --json '{"title": "New Presentation"}'

# Get a specific slide (page)
gws slides presentations pages get \
  --params '{"presentationId": "PRES_ID", "pageObjectId": "PAGE_ID"}'

# Get thumbnail of a slide
gws slides presentations pages getThumbnail \
  --params '{"presentationId": "PRES_ID", "pageObjectId": "PAGE_ID"}'

# Batch update (add slide, insert text, replace text, etc.)
gws slides presentations batchUpdate \
  --params '{"presentationId": "PRES_ID"}' \
  --json '{"requests": [{"duplicateObject": {"objectId": "PAGE_ID"}}]}'
```

### Notes

- Slides has no `+helper` commands — all operations go through `presentations` or `presentations pages`.
- `presentations.get` returns the full JSON structure: all slides, shapes, text runs, images, and speaker notes.
- Common `batchUpdate` request types: `createSlide`, `deleteObject`, `insertText`, `replaceAllText`, `updateTextStyle`, `updatePageElementTransform`.
- Presentation IDs appear in the URL: `docs.google.com/presentation/d/PRES_ID/edit`

---

## Workflow Helpers

```
gws workflow <command>
```

| Command | Purpose |
|---|---|
| `gws workflow +standup-report` | Today's meetings + open tasks |
| `gws workflow +meeting-prep` | Prep summary for next meeting |
| `gws workflow +weekly-digest` | Week in review summary |

---

## Key File IDs (Xander's AIOS)

Populate as you use these files in scripts. Get IDs from Drive URLs or `gws drive files list`.

| File | ID |
|---|---|
| WOKEN Job Search Tracker | `13w55tTP0kyRGz8BNaGq7CnAngoSIEOMOrHDrmO9Al58` |
| WOKEN Coaching Goals & Timeline | `1EewHA3lnxZ-2fzY8SywbZkYKrXJwE_32fV1nKOWcZ6w` |
| AI OS Personal (Doc) | `10WVsee3lv-9DdSDKMf3a88GG3nYYEjWp1z3P7D3fS64` |
| ISYE Company List | `14NLD210FK7RL_WR5cBENn3I4Q4O47E_r7u7R-iduPcc` |

---

## Discovering Schemas

```bash
# See the full API schema for any command before calling it
gws schema gmail.users.messages.list
gws schema drive.files.list
gws schema sheets.spreadsheets.values.get
gws schema docs.documents.batchUpdate
gws schema slides.presentations.batchUpdate
```

Use `--dry-run` to validate a request locally before it hits the API.
