# Speaker guide, final presentation (English)

Generated from the real slides by `node presentation-final/src/make-guide.mjs`. The per-slide part comes from `presentation-final/deck-en/`. If you edit the slides on claude.ai, copy the slide files back and regenerate this file. The header and the Q&A are in `src/guide-en.md`.

Every number matches the final report (`report/final/`) and `results-study3/numbers.json`. Table numbers refer to the final report (Tables 1 to 22). The report is in Thai, so when you cite a table, say "Table 11 in our report".

Slides on claude.ai: https://claude.ai/artifact/7ixEe1DRmC4R7cLqwCkSBs (private until you share it from the Share menu)

## Overview

| | |
|---|---|
| Time | About 12 minutes. With 10 minutes, cut as shown under "If time is short". |
| Audience | Committee and general audience. Use plain words, keep statistics to what is needed, and explain each term the first time. |
| Slides | 13 main slides and 6 backup slides, opened only when asked. |
| Speakers | Speaker 1 takes slides 1 to 7 (problem and method). Speaker 2 takes slides 8 to 13 (results and conclusion). Hand over at the end of slide 7. |
| Also open | The website https://teerapab149.github.io/skillbench/ in another tab for Q&A. The QR code is on the last slide. |
| Course rule | Do not read the slides. Use the notes as a guide and speak in your own words. Presenting in English earns 20 extra marks. |

### The one sentence people should remember

> **Both formats performed equivalently. But give your agent rules.**
>
> The first half is the tested main result. The second half is an exploratory observation. Say them differently.

### Words to avoid

| Do not say | Say instead | Why |
|---|---|---|
| "The two are the same" or "no difference" | "**equivalent** by the margin we set in advance" | Equivalent means within ±12.5 points, not zero difference (6.4 item 5) |
| "Skills is better" | "Skills is **not worse**" | +2.8 is not significant (p = 0.148) |
| "We proved rules beat no rules" | "The data **point that way**, but this part is exploratory" | A0 is not part of the main test |
| "Without rules the agent changed old invoices 25% of the time" | "Without rules the agent missed 18 of 72 past-invoice checks, **almost all by not checking or not reporting**" | Past totals actually changed in only A0 1/54 and A2 2/54 runs |
| "Skills is cheaper because of selective loading" | "Skills cost about 10% less, but **we cannot yet say why**" | A2 runs were also shorter |
| "Selective loading has no effect" | "Whether the loading mechanism matters **is still open**; it was not tested under our plan" | A2 vs A5 was closed by the fixed-sequence plan |

### Pronunciation and terms

| Term | How to say it |
|---|---|
| RCRc | "R C R c", or just "our compliance score" after the first time |
| CI | "confidence interval" the first time, then "the interval" |
| TOST | Avoid the acronym. Say "the equivalence test". |
| A0, A1, A2, A5 | "group A-zero", "A-one" and so on, or "no rules", "single file", "Skills", "Skills text always loaded" |
| CLAUDE.md | "Claude dot M D" |

<!-- SLIDES -->

## If time is short

| Time available | Cut or shorten | About |
|---|---|---:|
| 12 to 15 minutes | All 13 slides | 12 min |
| 10 minutes | Skip slide 10 (cost), shorten slide 5 to 0:40, give only the first two limitations | 10 min |
| 8 minutes | Also merge slide 4 into slide 3 and shorten slide 7 to 0:30 | 8.5 min |

**Never cut** slide 2 (why anyone should care), slide 8 (the main result), slide 9 (what people can use), and some form of the limitations.

## Q&A preparation

**Q: Isn't a ±12.5-point margin too wide? Equivalence is easy with that.**

> We set it before seeing any data. It equals missing about one critical rule per task, which a team would notice. We agree it is wide compared with the room left, because the single file already scored 94.5. With a ±5 margin the two-sided test would fail, because the upper bound is +5.8, but the non-inferiority side would still pass, because the lower bound is −0.1. Section 6.4, item 4, notes that this check was done after seeing the results.

**Q: Why did you stop at 3 repetitions when the plan allowed collection until 11 October?**

> We decided to stop on 9 October and reviewed that decision on 10 October using pooled data, without splitting by group. A fourth repetition would have narrowed the interval by only about 6%. The decision was made before looking at group results and is recorded as deviations D3 and D6 (Table 10, section 6.4 item 9). **Tell this in your own words, as it actually happened.**

**Q: You used Claude to study Claude. Isn't that biased?**

> We list it as a limitation in section 6.4, item 3, and in the preface. Scores come from programs, not from an AI judge. The plan and code were locked with a git tag before data collection, every commit can be traced, and the main decisions were ours. See backup slide B4.

**Q: Why didn't you test Skills against the same text always loaded (A2 vs A5)?**

> Our fixed-sequence plan allowed that test only if the main comparison found a difference. This controls the overall chance of a false conclusion. The main result was equivalence, so the gate stayed closed. The estimate is +2.0 points, reported only as a descriptive number (Table 13). Testing it directly is future work, section 7.3.1.

**Q: Does the +2.8 depend on a single task?**

> Without task S19 the gap is +1.3. Dropping any single task leaves it between +1.3 and +3.4. The conclusion does not change (section 6.4 item 12, backup slide B2).

**Q: You found grader bugs after locking the plan. Can we trust the result?**

> We found two real defects, S05 GP1 and S06 FL1. The main result used the original graders, as planned. Two sensitivity analyses, declared before we looked at results by group, give the same conclusion (Table 12, backup slide B1).

**Q: Studies 1 and 2 were inconclusive. Was that wasted effort?**

> No. They are the reason study 3 could reach an answer (section 6.2). The lesson is that measuring AI agents needs as much effort spent on checking the instrument as on collecting data (section 7.1, objective 2).

**Q: Why didn't you run the mixed-effects analysis you pre-registered?**

> This is listed in section 6.4, item 10. **Prepare this answer yourselves.**

**Q: Would this hold for GPT or Gemini?**

> We cannot say yet, because we tested one model. SkillBench is built so a second adapter can be added. That is future work, sections 7.3.2 and 7.3.5.

**Q: Why are the prompts in Thai?**

> Every task is a short Thai request, like one a Thai user would send to an agent. We list the single language as a limitation (section 6.4, item 1): results may differ with English prompts. Repeating the study in English is future work, section 7.3.2.

## Before the presentation (28 October)

- [ ] Read the notes and rewrite them in your own words, especially the stopping decision, the role of Claude and the mixed-effects question.
- [ ] Rehearse twice with a timer, then adjust "If time is short".
- [ ] Share the deck from the claude.ai Share menu if others need to open it.
- [ ] Open the website and the QR code on a real phone once before the day.
