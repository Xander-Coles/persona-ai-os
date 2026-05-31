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

**Required env vars** (all in `.env`):
- `JOB_TRACKER_WEBHOOK_URL` — deployed Google Apps Script web app URL
- `JOB_TRACKER_WEBHOOK_SECRET` — secret set in Script Properties

If either is missing, stop and tell the user: "Add `JOB_TRACKER_WEBHOOK_URL` and `JOB_TRACKER_WEBHOOK_SECRET` to `.env`. Deploy `scripts/job-tracker-webhook.gs` as a web app in Google Apps Script to get the URL."

---

## Column Map

The tracker has 24 columns (A–X). Always write in this order:

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
4. Check for duplicates by reading the current sheet:
   ```bash
   source .env 2>/dev/null || true
   curl -s "${JOB_TRACKER_WEBHOOK_URL}?secret=${JOB_TRACKER_WEBHOOK_SECRET}"
   ```
   Parse the returned JSON `rows` array. If a row with the same Company + Role Title exists (columns 0 and 1, 0-indexed), alert the user and ask whether to add anyway or update the existing row.
5. If clear to add, build the row (fill blanks with empty strings) and append:
   ```bash
   source .env 2>/dev/null || true
   curl -s -X POST "$JOB_TRACKER_WEBHOOK_URL" \
     -H "Content-Type: application/json" \
     -d "{\"secret\":\"$JOB_TRACKER_WEBHOOK_SECRET\",\"rows\":[[\"Company\",\"Role\",\"Y\",\"Industry\",\"Size\",\"URL\",\"8\",\"2026-05-31\",\"Applied\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\"]]}"
   ```
   Replace placeholder values with actual extracted data. Use empty strings for unknown fields.
6. Check the response: `{"success":true,"appended":1}` means it worked. If you see `{"error":...}`, report the error to the user.
7. After a successful write, compute the priority score (Step 3) and output the result block (Step 4).

---

## Step 2B: New Application — Gmail Scan Mode

Use the available Gmail MCP tools to search for application confirmation emails:

1. **Search Gmail** using the `mcp__claude_ai_Gmail__search_threads` tool with query:
   ```
   subject:(application received OR application submitted OR thank you for applying OR we received your application) newer_than:7d
   ```
   Limit to 30 results.

2. For each thread, use `mcp__claude_ai_Gmail__get_thread` to read the full body and extract Company Name, Role Title, and Date Applied.

3. **Read the current sheet** to find unlogged entries:
   ```bash
   source .env 2>/dev/null || true
   curl -s "${JOB_TRACKER_WEBHOOK_URL}?secret=${JOB_TRACKER_WEBHOOK_SECRET}"
   ```
   Cross-reference the returned `rows` array against the Gmail results. Filter to only threads not already in the sheet (match on Company Name in column A).

4. If no new applications found, tell the user and suggest broadening the date range or checking Gmail manually.

5. Present a batch summary before writing:
   ```
   Found 3 unlogged applications:
   1. Salesforce — Account Executive (May 22)
   2. Anthropic — Solutions Engineer (May 24)
   3. Rippling — PM, AI (May 25)

   For each: what's your Interest score (1–10)? Any networking contacts to note?
   ```

6. After the user responds, append all confirmed rows in one call per row (or batched if multiple):
   ```bash
   source .env 2>/dev/null || true
   curl -s -X POST "$JOB_TRACKER_WEBHOOK_URL" \
     -H "Content-Type: application/json" \
     -d "{\"secret\":\"$JOB_TRACKER_WEBHOOK_SECRET\",\"rows\":[[\"Company\",\"Role\",\"Y\",\"Industry\",\"Size\",\"URL\",\"8\",\"2026-05-22\",\"Applied\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\"],[...]]}"
   ```

7. Compute and display priority scores for all added roles.

---

## Step 2C: Status Update Mode

Triggered when the user reports a stage change (round invite, scheduled call, no response, offer, rejected, etc.).

1. Read the full sheet to find the matching row:
   ```bash
   source .env 2>/dev/null || true
   curl -s "${JOB_TRACKER_WEBHOOK_URL}?secret=${JOB_TRACKER_WEBHOOK_SECRET}"
   ```
   Parse the `rows` array. Row index 0 is the header. The target row number in the sheet = array index + 1 (1-indexed).

2. Match by Company Name (column A) and Role Title (column B) if ambiguous. If multiple matches, ask the user to clarify.

3. Identify which column(s) to update based on the stage:
   - Round 2 invite → col W (index 22)
   - Round 3 invite → col X (index 23)
   - Phone screen → col V (index 21)
   - Call scheduled → col T (index 19) + col S (index 18)
   - Reached out → col P (index 15)
   - Follow-up sent → col R (index 17)
   - Status change (rejected, offer, etc.) → col I (index 8)

4. Convert to A1 notation (e.g., row 5, col I = "I5") and update:
   ```bash
   source .env 2>/dev/null || true
   curl -s -X POST "$JOB_TRACKER_WEBHOOK_URL" \
     -H "Content-Type: application/json" \
     -d "{\"secret\":\"$JOB_TRACKER_WEBHOOK_SECRET\",\"action\":\"update\",\"range\":\"I5\",\"values\":[[\"Rejected\"]]}"
   ```
   Replace `"I5"` and `"Rejected"` with the actual cell reference and value.

5. Check the response for `{"success":true,...}` before reporting success.

6. After writing, output the result block with updated next action.

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

## Step 4: Output Format

After every successful write, output:

```
Logged: [Company] — [Role Title]
Status: [Applied / Tracking / Round N / etc.]
Priority Score: [X.X / 10]  (Role Fit: X | Interest: X | Urgency: X | Company: X)
Next Action: [recommendation]
```

**Next Action logic — show only the single most relevant:**

| Condition | Recommendation |
|-----------|---------------|
| Cols J–L all empty | "Research your network on LinkedIn — do you know anyone at [Company]?" |
| Cols J–L filled, col P empty | "Reach out to [name] today." |
| Col P filled, col R empty | "Schedule a follow-up for [6 days from reach-out date]." |
| Col R date is past | "Follow up now — it's been [N] days since your last contact." |
| Cols J–L empty, cols M–O empty | "Identify a cold contact: check LinkedIn for someone on the team, hiring manager, or recruiter." |
| 1st Round filled, 2nd Round empty | "Prep for 2nd round — review call notes and research the company deeper." |
| Status = Offer | "You have an offer — log the details and decide next steps." |
| Status = Rejected | "Closed. Consider a warm follow-up if the conversation was strong." |

For Gmail batch mode, show one row per logged application, then:
```
Added [N] applications. Highest priority: [Company] — [Role] ([score]/10)
```

---

## Notes

- Never fill networking columns (J, K, L, M, N, O) with guesses. Only use what the user explicitly provides.
- Never set Applied? = "Y" automatically. Ask if it's unclear.
- Interest score must always come from the user — never infer it.
- Row numbers are 1-indexed in the sheet. Row 1 = header. Array index 0 in the `rows` response = header row. Target row number = array index + 1.
- The `curl` update range uses the sheet's column letters (A–X), not 0-indexed numbers.
- If `curl` returns an error or non-JSON, report it verbatim to the user rather than silently failing.
- The doGet endpoint requires the secret as a query param. The doPost endpoint requires it in the JSON body.
