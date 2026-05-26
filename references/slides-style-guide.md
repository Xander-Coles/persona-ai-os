# Slides Style Guide

Used by `/validate-slides` to flag deviations. Fill in your preferences below.
Sections marked `[TODO]` are prompts — replace with your actual values.
Sections marked with inferred values were derived from your existing slides.

---

## Fonts

| Element | Font | Size | Weight |
|---|---|---|---|
| Slide title | [TODO — e.g. Calibri, Arial, Google Sans] | [TODO — e.g. 28pt] | Bold |
| Body / bullets | [TODO] | [TODO — e.g. 14pt] | Regular |
| Labels / callouts | [TODO] | [TODO — e.g. 11pt] | Regular or Bold |
| Footer / slide number | [TODO] | [TODO — e.g. 10pt] | Regular |

**Max title length (characters before wrapping risk):** [TODO — e.g. 60 chars]
**Title must always fit on one line:** Yes / No

---

## Colors

| Role | Hex |
|---|---|
| Primary / accent | [TODO — e.g. #003087] |
| Secondary | [TODO] |
| Background (default) | [TODO — e.g. #FFFFFF] |
| Text (default) | [TODO — e.g. #000000] |
| Highlight / callout box | [TODO] |

---

## Layout Rules

**Max bullets per slide:** [TODO — e.g. 5]
**Max words per bullet:** [TODO — e.g. 15]
**Max text density:** [TODO — e.g. no more than 80 words of body text per slide]
**Diagrams must have a title:** Yes / No
**Every slide must have a title:** Yes / No
**Slide numbers:** Required / Optional / None

---

## Inferred Style (from KPMG deck — 2026-05-26)

Observed from your existing slides. Treat as defaults until you override above.

- **Color palette:** Navy blue (#1F3864 approx), KPMG blue (#00338D approx), white backgrounds, dark grey text
- **Title style:** Left-aligned, bold, larger than body, dark text on white
- **Body text:** Left-aligned bullets, moderate density
- **Diagrams:** Heavy use of circle/spoke diagrams, swimlane timelines, structured tables
- **Slide header:** Small brand label top-left (e.g. "| KPMG Firmwide Ecosystem") on content slides
- **Footer:** Slide number bottom-right or bottom-left

---

## Content Rules

Things to flag as errors regardless of visual appearance:

- Typos in titles or visible body text
- Title that wraps to 2+ lines
- Slide with no title and no diagram (blank-looking slide)
- Text outside slide bounds (clipped)
- Bullet with more than [TODO] words
- Inconsistent use of capitalization in titles (e.g. Title Case vs sentence case mixed)
- Dense text slides (>80 words) with no visual break
- Slide that appears to be a duplicate of another
- Logical gaps: a section referenced in one slide that has no corresponding content slide

---

## Slide Structure (typical deck flow)

[TODO — describe your typical deck structure, e.g.:]
- Cover / title slide
- Agenda / table of contents
- Section dividers
- Content slides (max N per section)
- Appendix (clearly labeled)

---

## What Good Looks Like

[TODO — paste a Google Slides URL of a deck you consider well-formatted, for reference]

Reference deck: _______________
