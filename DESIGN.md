# Design

The SkillBench site (`site/`, published to `docs/`) is a research report in the style of a clinical-trial journal article, not a landing page. It reads like a printed paper: white paper, black ink, booktabs tables, numbered figures with captions, a forest plot and a CONSORT-style flow diagram. The result and its exact strength come first. Every number can be traced back to a run.

## Principles

1. **Result first, at its true strength.** The verdict wording is fixed: "เทียบเท่า" (equivalent), "ไม่ด้อยกว่า" (not worse than), "สรุปไม่ได้" (inconclusive). Exploratory material is marked with brick and the label "เชิงสำรวจ".
2. **No hand-typed numbers.** Pages read `results*/`, `scenarios/`, `config/` and `arms/` at build time through `site/src/lib/data.ts`. `scripts/verify-data.mjs` runs before every build and stops it if a check fails.
3. **Phone first.** Most readers arrive from the QR code on the last slide. Every page is checked at 375 to 390 px with no sideways page scroll.
4. **Plain Thai, no decorative punctuation.** No "·" separators, no em-dash asides, no emoji. Labels are short phrases.

## Color

Tokens are defined in `site/src/styles/global.css` (`:root`).

| Token | Value | Use |
|---|---|---|
| `--paper` | `#fdfdfb` | page background |
| `--paper-2` | `#f4f4f0` | code blocks, quiet panels |
| `--ink` / `--ink-2` / `--ink-3` | `#161b26` / `#3f4756` / `#6a7180` | text, secondary text, captions and axes |
| `--rule` / `--rule-strong` | `#d6d8dd` / `#161b26` | thin table rules, thick top and bottom rules |
| `--teal` / `--teal-wash` | `#0b6e69` / `#e3f0ee` | the primary result and the equivalence margin, nothing else |
| `--brick` / `--brick-wash` | `#b4561c` / `#f8ebe0` | exploratory analyses, cautions, failed runs |

Arm colors are used only when arms are compared side by side: A0 `#8a929e`, A1 `#2f4f86`, A2 `#0b6e69`, A3 `#7a5c99`, A4 `#a8506f`, A5 `#b7791f`. The same colors are used in the slides and the report figures.

The landing page is the only dark surface: a six-scene story on ink (`#0e131c`) with light teal `#3fb3a6` and light brick `#e0874f` as the result and miss colors. Every other page stays on white paper.

## Type

- Headings and figure or table labels: **Noto Serif Thai** 500 to 700.
- Body text: **Sarabun** 400, 600 and 700, base size 1rem (1.06rem at 640 px and below).
- Run ids, file names and rule ids: **IBM Plex Mono** 400 and 500.
- Fonts are self-hosted through `@fontsource`, so no request goes to a font CDN.
- Reading width `--measure: 44rem`. Wide figures and tables use `--wide: 70rem`.

## Components

| Component | File | Notes |
|---|---|---|
| Masthead and mobile menu | `layouts/Base.astro` | full nav above 860 px. Below that, a `<details class="mnav">` menu labelled with the current page |
| Run field | `components/RunField.astro` | landing hero, one mark per run |
| Three studies chart | `components/ThreeStudies.astro` | primary difference and 95% CI of each study on one axis. Has a separate narrow SVG for 640 px and below |
| Forest plot | `components/ForestPlot.astro` | study 3 primary result plus SA-1 and SA-2, with the ±12.5-point margin and the ceiling line. Has a narrow SVG |
| Per-scenario strip | `components/DiffStrip.astro` | win, loss or tie per scenario |
| Arm bars | `components/ArmBars.astro` | per-arm means |
| Flow diagram | `components/Consort.astro` | planned runs, collected runs, runs per arm, unit of analysis |
| Booktabs table | `table.bt` in `global.css` | caption above the table, thick top and bottom rules, numbers right-aligned on one line. Wrapped in `.tbl-wrap`, which scrolls sideways on a phone while the caption stays in view |
| Section index | `components/Toc.astro` | in-page contents on long pages |
| Run sheet | `components/Sheet.astro` | per-rule detail of one run |

## Figures and tables

- Tables are numbered with the label **above** ("ตารางที่ n"). Figures are numbered with the label **below** ("รูปที่ n"). This matches the course report format.
- Every figure caption says what the marks mean and how to read the result, including its limits.
- SVG text uses the page fonts and color tokens. No chart library is used.

## Responsive rules

- Breakpoints: 860 px (nav switches to the menu), 760 px (explore grid goes to three columns), 640 px (charts switch to their narrow SVG, tables tighten).
- No element may widen the page past the viewport. Wide tables scroll inside `.tbl-wrap`.
- Text in charts on a phone is at least 12 px when rendered.

## Pages

| Path | Content |
|---|---|
| `/` | dark scroll story in six scenes: the question with a real agent log, the invoice problem, the two ways of giving rules, all 660 runs, the answer, and Explore |
| `/overview/` | the full overview: answer, three-study chart, invoice example, real rule files, findings, the three studies, links |
| `/background/` | what context engineering and Agent Skills are, where they came from, with a dated timeline and sources |
| `/study-1/`, `/study-2/`, `/study-3/` | design, flow diagram, primary result, per-scenario results, what changed next |
| `/arms/` | arms A0 to A5 with the full rule text each one received |
| `/scenarios/`, `/scenarios/<id>/` | the scenarios, their traps and rules, and results in each study |
| `/runs/?study=n` | every graded run, per rule |
| `/method/` | one run step by step, the metrics and the statistics |
| `/protocol/` | the three pre-registrations, deviations and course requirements |
| `/skillbench-report.pdf` | the final report |

## Sharing and accessibility

- Every page carries Open Graph and Twitter card tags (`layouts/Base.astro`). The share image is `site/public/og.png`, 1200×630, generated from the result files by `node scripts/make-og.mjs` (headless Edge). Regenerate it if the results change.
- Documents rendered from markdown (rule files, pre-registrations) go through `src/lib/md.ts`, which pushes their headings down two levels so each page keeps a single `h1` and an unbroken heading order. Their look comes from the `md-h1` to `md-h3` classes.
- Dense run grids are not in the tab order. Keyboard users reach runs through one link per study in the run field caption and through the rep-number headers of each scenario's rule matrix. Every cell still has a text label for screen readers.

## Landing story and motion

- `src/pages/index.astro` is a scroll story. Each scene is a `[data-scene]` section; an IntersectionObserver adds `.in` once, and CSS transitions run from that class. Motion only applies under `html.motion`, which the script sets unless the visitor prefers reduced motion. Without JavaScript or with reduced motion every scene shows its final state.
- One authored moment per scene: the user prompt types out and the agent steps appear (scene 1), the invoice total counts from the old to the new amount (2), rule chips fall into the context box while only the needed skills rise into it (3), the 660 run dots fly into the three study grids (4), the equivalence band opens, the interval draws in and the estimate lands, then the rule bars grow (5).
- All content is real: the terminal shows the files a real no-rules run changed on S09, the skills that move are S09's expected skills, and every number comes from `lib/data.ts`.
- Easing is `cubic-bezier(0.16, 1, 0.3, 1)` throughout; no bounce.
