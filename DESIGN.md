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

The landing page is the only dark surface: ink `#0b0f16` with rooms in slate `#121826`, indigo `#111c3d` and deep teal `#0a2924`, ending on paper `#f2efe8`. The run colors and the single-file blue `#4a6fb0` stay the data hues. Every other page stays on white paper.

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
| `/` | dark scroll story: the official title over a city of the 660 runs, the agent log and invoice diff, context tapes of the two ways, the city flattening into the three study grids and the answer band, the rules finding, and an index |
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

The landing (`src/pages/index.astro`) is a model of the evidence. It does not borrow any outside layout: no colored card panels, no stickers, no oversized display numerals.

- **The city of runs.** A sticky `<canvas>` behind the story draws all 660 real runs as square pillars, three districts for the three studies.
  - Pillar height follows the run's real score, colored from miss (`#d9733a`) to full compliance (`#3fb3a6`).
  - The pillars stand on a graph-paper floor drawn in the same coordinates as the run grids. This is the only grid on the page: a CSS grid background was rejected as decoration.
  - The camera sways slightly in the hero.
- **Lead-in.** An empty 80svh lead before the experiment lets the city rise to the center of the screen, clear of the rooms, before the camera moves.
- **Answer hold.** The answer card is pinned at the middle of the screen for 70svh while the run tiles land in the band, so the card and the chart are complete together. The band sits at mid-screen on desktop.
- **Camera move.** As `#experiment` scrolls, the camera turns and tilts down until it looks straight down, so the city becomes the three flat study grids. Progress `q` runs from 0 to 1:
  - 0.02 to 0.28: the camera flattens the city into the grids
  - 0.38 to 0.48: studies 1 and 2 dim, with their real verdicts
  - 0.64 to 0.8: the band opens and study 3's A1 and A2 runs fly into it
  - 0.8 to 0.93: those runs flatten into the CI90 line and the estimate lands
- **Rooms.** Each other scene has its own dark tone, a gradient full-bleed band with no card edges: cool slate for the problem, indigo for the two ways, deep teal for the rules, then a light paper ending for Explore. Secondary text is tinted from each room's hue. Behind the canvas the ink turns deep teal as the answer appears. Each room shows its evidence in its native form:
  - the real S09 agent log as a terminal
  - the invoice change as a code diff, with lines that strike and add on scroll
  - the two ways of giving rules as context tapes measured in real characters from the rule files (single file 4,518 at start; Skills 1,946 at start plus each expected skill, with `safe-shell` left unread)
  - the rules finding as four two-tone columns that echo the pillars
  - Explore as a table-of-contents index
- **Type.** Headings are Noto Serif Thai 600 to 700. Measured values are IBM Plex Mono readouts. The hero carries the official research title, with the plain question under it.
- **Nav.** On the landing, the nav collapses to the brand plus one "สำรวจทั้งหมด" link (`theme="story"` in `Base.astro`).
- **Fallbacks.** With reduced motion, the canvas snaps to whole states and every `--p` scrub stays at its final value. Without JavaScript, static figures show instead.
- **Easing.** `cubic-bezier(0.16, 1, 0.3, 1)` throughout, with no bounce.
