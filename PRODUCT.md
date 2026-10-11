# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Framework (user's choice, 11 ต.ค. 2569). Astro was chosen because it builds a static site at build time, which fits the project's rule that no number is typed by hand. Output is a static build deployed to GitHub Pages (`teerapab149.github.io/skillbench/`, which serves `main:/docs`). Publishing needs a push to `main`, and the researcher confirms each push.

## Users

1. **Audience at the final presentation (477-401)**: general attendees who scan a QR code at the end of a 10–15 minute talk. They read on a phone and should understand the main result within about 30 seconds.
2. **Committee during Q&A**: the presenter projects the site and jumps to a specific run, scenario or rule to answer a question.
3. **Committee reviewing later**: they read on a desktop and check numbers back to the data, the pre-registration and the report.

## Product Purpose

SkillBench is a closed measurement system and controlled experiment. It asks whether delivering the same team rules to a coding agent as Agent Skills (loaded on demand) or as one always-loaded file (`CLAUDE.md`) changes rule compliance. The site presents all three studies in the order they were run (study 1 with 220 runs, study 2 with 176, study 3 with 264) as a readable story, with study 3 as the final, confirmatory study. Every claim can be traced to the runs, scenarios and rule texts behind it.

## Positioning

Every number comes from programmatic grading of real agent traces: files changed, commands run, replies given and retro-billing probes. No human or LLM judge is involved. The analysis plan was pre-registered and locked with a git tag before data collection, and all deviations are disclosed.

## Operating Context

- Presented together with a slide deck (`presentation-final/SLIDES-FINAL.md`), with a QR code on the last slide.
- The report is `report/final/` (Thai technical report, ฉบับสมบูรณ์).
- Studies 1 and 2 were inconclusive. Each has its own page with its design, primary result, per-scenario differences and what changed for the next study.
- The final report PDF is published with the site at `/skillbench-report.pdf`.

## Capabilities and Constraints

- Thai only.
- Study 1 data: 5 arms (A0 to A4), 11 scenarios, 4 reps (6 planned, stopped at 4 under the fallback rule), 220 runs, metric CRIT. Study 2 data: 4 arms (A0, A1, A2, A5), 11 scenarios, 4 reps, 176 runs, metric RCRc.
- Study 3 data: 4 arms (A0 no rules, A1 single file, A2 Agent Skills, A5 A2's text always loaded), 22 scenarios, 3 reps, 264 runs, model `claude-sonnet-5`.
- Sources: `results*/numbers.json`, `evidence/study1-scenarios`, `evidence/study2-scenarios`, `config/arms*.json`, `results-study3/numbers.json`, `results-study3/latest.json`, `results-study3/sensitivity.json`, `scenarios/*.json`, `config/arms-study3.json`, `arms/**`.
- **No hand-typed result numbers.** Every number is derived at build time from the files above.
- Wording rules that must hold:
  - "เทียบเท่า" (equivalent within ±12.5 pts), never "เหมือนกัน" (same).
  - A2 is "ไม่ด้อยกว่า" (non-inferior to) A1, never "better".
  - A0 comparisons, cost and the decomposition are labeled "เชิงสำรวจ" (exploratory).
  - A2 vs A5 was "not tested" because the fixed-sequence gate is closed.
  - A0 "did not check or report impact" on retro billing. Do not say it "changed past invoices".
- Do not publish transcripts or quarantined memory evidence.

## Evidence on Hand

- Real data: 264 graded runs with per-rule pass/fail, rule texts per arm, the 22 scenario prompts and rules, and sensitivity analyses SA-1/SA-2.
- Report figures: `report/final/build/figures/`. Slide figures: `presentation-final/figures/`.
- There are no testimonials, endorsements or external citations of this work. None may be invented.

## Product Principles

1. The result comes first and is stated with its exact strength. Overclaiming is a defect.
2. Every number can be traced to its source run or file.
3. Make it understandable to a non-specialist in seconds, and checkable by a specialist in minutes.
4. Disclose the inconclusive path and the deviations; do not hide them.

## Accessibility & Inclusion

Mobile-first readability for Thai script: most of the audience opens the site on a phone from the QR code, so every page is checked at 375 to 390 px with no sideways scrolling, and charts have a separate narrow layout. The site must also be legible when projected on a large screen.
