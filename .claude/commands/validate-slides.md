# /validate-slides

Visual validation skill for Google Slides decks.

## What this does

1. Runs `scripts/validate_slides.js` to screenshot every slide (Chrome CDP if available, Slides API thumbnails otherwise)
2. Reads each screenshot as an image — real visual inspection, not guesswork
3. Checks against `references/slides-style-guide.md`
4. Flags issues: typos, wrapping titles, dense text, style deviations, logical gaps, blank slides
5. Offers to auto-fix issues via the Slides API where possible

## Usage

```
/validate-slides <google-slides-url>
/validate-slides <presentation-id>
```

## Steps to follow

### 1. Capture screenshots

Run the capture script:

```bash
node scripts/validate_slides.js "$ARGUMENTS"
```

Parse the output — each slide has a `SLIDE N | title` line followed by a `PATH /path/to/file.png` line.

### 2. Read the style guide

Read `references/slides-style-guide.md` to load the brand rules before reviewing.

### 3. Review every slide

For each screenshot path output by the script, use the Read tool to view the image.
Do NOT skip slides — review all of them.

For each slide, check:
- **Title:** Present? Fits on one line? No typos?
- **Text density:** Does body text fit without overflow? Max ~80 words?
- **Font consistency:** Matches style guide?
- **Diagram labels:** Readable at slide scale? Not cut off?
- **Color usage:** Matches brand palette?
- **Logical content:** Does this slide make sense in context of surrounding slides?
- **Blank/placeholder slides:** Any slides with no content?

### 4. Output a validation report

Format the report as:

```
## Slide Validation Report — [Deck Title]
Captured: [method — Chrome CDP or API thumbnails]
Slides reviewed: N

### Issues Found

**Slide N — [Title]**
- [CRITICAL / WARNING / MINOR] description of issue
- Suggested fix: ...

### Clean Slides
Slides N, N, N — no issues found.

### Summary
X critical, Y warnings, Z minor issues.
Auto-fixable via Slides API: [list]
Manual fixes needed: [list]
```

### 5. Offer fixes

After the report, ask: "Want me to fix any of these?"

For auto-fixable issues (typos in text, title text changes), use:
```bash
gws slides presentations batchUpdate \
  --params '{"presentationId": "PRES_ID"}' \
  --json '{"requests": [{"replaceAllText": {"containsText": {"text": "Understaning"}, "replaceText": "Understanding"}}]}'
```

For layout issues (font size, box resize), describe exactly what to change and offer to apply via batchUpdate with the appropriate request type.

## Chrome CDP setup (for pixel-exact screenshots)

If Chrome is not already running with remote debugging:

```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

Or create a shortcut with that flag. The script auto-detects and falls back to API thumbnails if Chrome isn't available on port 9222.