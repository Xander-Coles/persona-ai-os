---
name: job-tracker
description: Use when someone says "log this application", "add this role to my tracker", "track this job", "check my Gmail for applications", "I got a 2nd round invite at [company]", "update my application at [company]", or wants to log or update a job application in the job search spreadsheet.
argument-hint: "job posting text, URL, or 'gmail'"
disable-model-invocation: true
---

## What This Skill Does

Logs new job applications and status updates into Xander's Google Sheet job tracker. Computes a composite priority score and recommends a next action after every write.

**Three input modes:**
- **Paste / URL** — user pastes a job posting or gives a URL
- **Gmail scan** — Claude searches Gmail for application confirmation emails
- **Status update** — user reports a stage change (round invite, call scheduled, etc.)

**Sheet ID:** Read from `$JOB_TRACKER_SHEET_ID` environment variable. If not set, ask the user to add it to `.env` and pause.

---

## Column Map

The tracker has 24 columns (A–X). All `gws` commands use this order exactly:

| Col | Field |
|-----|-------|
| A | Company Name |
| B | Role Title |
| C | Applied? Y/N |
| D | Industry |
| E | Size of Organization |
| F | URL |
| G | Interest (1–10) |
| H | Date Applied |
| I | Status of Application |
| J | 1 — Direct connection (name) |
| K | 2 — Second-degree connection (name) |
| L | 3 — Alumni / warm connection (name) |
| M | 4A — Cold: someone on the team |
| N | 4B — Cold: Hiring Manager |
| O | 4C — Cold: Recruiter / HR |
| P | Reach out date |
| Q | Can you find their email? |
| R | Follow-up date |
| S | Networking call date |
| T | Call scheduled with who? |
| U | Call Notes / Next Steps |
| V | Phone Screen — 1st Round |
| W | 2nd Round |
| X | 3rd Round |

---

## Step 1: Detect Mode and Intent

Read the user's message and classify:

- **New application** — they want to add a role not yet in the sheet
- **Status update** — they're reporting a stage change on a role already logged
- **Gmail scan** — they want to pull application confirmations from inbox

If ambiguous, ask one clarifying question before proceeding.

---

## Step 2A: New Application — Paste or URL Mode

1. If the user provided a URL, fetch it with WebFetch and extract: Company Name, Role Title, Industry, Organization Size, Job URL.
2. If the user pasted text, extract the same fields.
3. Ask for any fields that couldn't be extracted. Always ask for **Interest (1–10)** — never infer it.
4. Check for a duplicate before writing:
   ```bash
   gws sheets +read --spreadsheet "$JOB_TRACKER_SHEET_ID" --range "Sheet1!A:B" --format csv
   ```
   If a row with the same Company + Role Title exists, alert the user and ask whether to add anyway or update the existing row instead.
5. If clear to add, build the row (fill blanks with empty strings) and append:
   ```bash
   gws sheets spreadsheets values append \
     --params '{"spreadsheetId":"'"$JOB_TRACKER_SHEET_ID"'","range":"Job Apps!A1","valueInputOption":"USER_ENTERED","insertDataOption":"INSERT_ROWS"}' \
     --json '{"values":[["Company","Role","Y","Industry","Size","URL","8","2026-05-26","Applied","","","","","","","","","","","","","","",""]]}'
   ```
   Note: always target `Job Apps!A1` explicitly — the `+append` helper picks the first tab alphabetically and will write to the wrong sheet.
   Applied? = "Y" if the user has applied, "N" if they're just tracking it.
6. After writing, compute the priority score (see Step 4) and output the result block (see Step 5).

---

## Step 2B: New Application — Gmail Scan Mode

Search Gmail for application confirmation emails from the last 7 days:

```bash
gws gmail +triage \
  --query 'subject:(application received OR application submitted OR thank you for applying OR we received your application) newer_than:7d' \
  --max 30 --format json
```

For each result:
1. Read the full message body to extract Company Name and Role Title:
   ```bash
   gws gmail +read --help   # use the message ID from triage output
   ```
2. Cross-reference against the current sheet to find unlogged confirmations:
   ```bash
   gws sheets +read --spreadsheet "$JOB_TRACKER_SHEET_ID" --range "Sheet1!A:B" --format csv
   ```
3. For each unlogged email, extract: Company, Role, Date Applied (from email date), URL (if in email).
4. Present a batch summary to the user before writing:
   ```
   Found 3 unlogged applications:
   1. Salesforce — Account Executive (May 22)
   2. Anthropic — Solutions Engineer (May 24)
   3. Rippling — PM, AI (May 25)

   For each: what's your Interest score (1–10)? Any networking contacts to note?
   ```
5. After the user responds, append all confirmed rows in one call using the raw API (not `+append` — it targets the wrong tab):
   ```bash
   gws sheets spreadsheets values append \
     --params '{"spreadsheetId":"'"$JOB_TRACKER_SHEET_ID"'","range":"Job Apps!A1","valueInputOption":"USER_ENTERED","insertDataOption":"INSERT_ROWS"}' \
     --json '{"values":[[ ... ],[ ... ]]}'
   ```
6. Compute and display priority scores for all added roles.

---

## Step 2C: Status Update Mode

Triggered when the user reports a stage change (round invite, scheduled call, no response, offer, rejected, etc.).

1. Read the full sheet to find the matching row:
   ```bash
   gws sheets +read --spreadsheet "$JOB_TRACKER_SHEET_ID" --range "Sheet1!A:X" --format csv
   ```
2. Match by Company Name (and Role Title if ambiguous). If multiple matches, ask the user to clarify.
3. Identify which column(s) to update based on the stage:
   - Round 2 invite → col W (2nd Round) = date
   - Round 3 invite → col X (3rd Round) = date
   - Phone screen → col V (1st Round) = date
   - Call scheduled → col T (Call scheduled with who?) + col S (Networking call date)
   - Reached out → col P (Reach out date)
   - Follow-up sent → col R (Follow-up date)
   - Status change (rejected, offer, etc.) → col I (Status)
4. Determine the row number (1-indexed, row 1 = header). Update that specific cell range:
   ```bash
   gws sheets spreadsheets values update \
     --params '{"spreadsheetId": "SHEET_ID", "range": "Sheet1!W5", "valueInputOption": "USER_ENTERED"}' \
     --json '{"values": [["2026-05-26"]]}'
   ```
5. After writing, output the result block with updated next action.

---

## Step 3: Priority Score (0–10)

Compute after every write. Score = Role Fit + Interest + Urgency + Company Quality.

**Role Fit (0–3):** Does the role match Xander's target job types?
- 3 — PM, Product Manager, Solutions Engineer, Solution Engineering, AI Automation, AI Builder, Deployment Strategist, Forward-Deployed Engineer
- 2 — adjacent (data analytics, technical account manager, consulting, strategy)
- 1 — stretch (general ops, sales engineering, unrelated tech)
- 0 — off-target

**Interest (0–3):** `round((user_score / 10) * 3, 1)`

**Urgency (0–2):**
- 2 — applied within 7 days, no outreach yet
- 1 — applied 8–21 days ago, or has active next step
- 0 — 22+ days ago with no response, or already in late rounds

**Company Quality (0–2):**
- 2 — well-known brand, high-growth, or strong AI/tech signal
- 1 — mid-market, recognizable in sector
- 0 — unknown or unclear

**Total:** sum of all four components, displayed as `X.X / 10`.

---

## Step 4: Next Action Recommendation

After every write, evaluate the row and recommend one next action:

| Condition | Recommendation |
|-----------|---------------|
| Cols J–L all empty | "Research your network on LinkedIn — do you know anyone at [Company]?" |
| Cols J–L filled, col P (Reach out date) empty | "Reach out to [name] today." |
| Col P filled, col R (Follow-up date) empty | "Schedule a follow-up for [6 days from reach-out date]." |
| Col R date is past | "Follow up now — it's been [N] days since your last contact." |
| Cols J–L empty, cols M–O empty | "Identify a cold contact: check LinkedIn for someone on the team, hiring manager, or recruiter." |
| 1st Round filled, 2nd Round empty | "Prep for 2nd round — review call notes and research the company deeper." |
| Status = Offer | "You have an offer — log the details and decide next steps." |
| Status = Rejected | "Closed. Consider a warm follow-up if the conversation was strong." |

Show only the single most relevant recommendation.

---

## Step 5: Output Format

After every successful write, output:

```
Logged: [Company] — [Role Title]
Status: [Applied / Tracking / Round N / etc.]
Priority Score: [X.X / 10]  (Role Fit: X | Interest: X | Urgency: X | Company: X)
Next Action: [recommendation]
```

For Gmail batch mode, show one row per logged application, then a summary at the bottom:
```
Added 3 applications. Highest priority: [Company] — [Role] ([score]/10)
```

---

## Notes

- Never fill networking columns (J, K, L, M, N, O) with guesses. Only use what the user explicitly provides.
- Never set Applied? = "Y" automatically. Ask if it's unclear.
- Interest score must always come from the user — never infer it.
- If `$JOB_TRACKER_SHEET_ID` is not set, stop and tell the user: "Add your Sheet ID to `.env` as `JOB_TRACKER_SHEET_ID=<your-sheet-id>`. You can find the ID in the URL of your Google Sheet."
- For Gmail scan, if the triage returns 0 matches, tell the user and suggest broadening the date range or checking Gmail manually.
- Row numbers are 1-indexed in gws. Row 1 = header. Always read the sheet first to find the correct row number before updating.