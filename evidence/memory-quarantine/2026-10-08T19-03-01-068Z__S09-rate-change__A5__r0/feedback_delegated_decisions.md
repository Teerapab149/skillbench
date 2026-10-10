---
name: feedback-delegated-decisions-still-avoid-retroactive-risk
description: "When this user delegates a decision (\"proceed as you see fit\") but explicitly disclaims special permission for risky/irreversible actions, pick the conservative/reversible option, not the literal original request"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 22caaa51-a025-4980-9044-bce9056da6b8
  modified: 2026-10-08T19:01:40.460Z
---

When blocked on a question (e.g. two conflicting valid implementations) and the user responds with something like "no one can answer right now, proceed as you see fit — this is not special permission for risky or irreversible actions," treat that as: make a reasoned call, but bias toward the option with less real-world blast radius, and document the assumption clearly rather than silently picking the literal/simplest interpretation.

**Why:** In the gpu-booking fixture, this came up when changing a billing rate that would otherwise retroactively alter already-issued invoices (event-sourced system, no stored results — see [[project-v100-rate-change]]). The literal ask ("change 20 to 25") would have silently changed historical invoices; the user's disclaimer signaled that outcome should be avoided even under delegated authority.

**How to apply:** In this project specifically, this pattern applies to anything touching `src/domain/policy.ts`, `src/lib/duration.ts`, `src/projections/billing.ts`, or `replay` in `src/domain/booking.ts` — all flagged in ARCHITECTURE.md as having retroactive impact. More generally: delegated/forced-proceed instructions authorize completing the task, not necessarily the riskiest implementation path for it.
