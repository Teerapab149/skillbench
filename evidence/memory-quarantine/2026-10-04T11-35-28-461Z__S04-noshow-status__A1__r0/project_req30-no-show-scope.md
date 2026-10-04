---
name: project-req30-no-show-scope
description: REQ-30 (NO_SHOW) was implemented as APPROVED-only; REQUESTED-without-approval bookings deliberately excluded
metadata: 
  node_type: memory
  type: project
  originSessionId: 9c436687-2ad2-4887-9b30-dc928e36e52c
  modified: 2026-10-04T11:35:10.858Z
---

REQ-30 (auto-transition to `NO_SHOW` after 30 min grace past `startAt` with no start) is implemented in `src/domain/booking.ts`'s `replay()`, strictly as `APPROVED → NO_SHOW` only, matching the state diagram in REQUIREMENTS.md section 4 literally.

**Why:** `seed.ts:82`'s comment suggests bookings stuck in `REQUESTED` (ones that never needed approval and were never started) were also expected to eventually become no-show, but the REQUIREMENTS.md diagram only draws the `NO_SHOW` arrow from `APPROVED`. Since a code comment isn't a REQ-ID-backed requirement and the user was unavailable to confirm extending scope (see [[feedback-unavailable-user-judgment]]), the conservative/spec-literal reading was kept: no transition was added for `REQUESTED` bookings.

**How to apply:** If asked to extend no-show detection to `REQUESTED` (non-approval) bookings later, treat it as new work needing its own REQ-ID / explicit user confirmation, not a bug fix to REQ-30. Verified at the time: `node tools/revenue-report.ts` showed no change (2026-05=2140, 2026-06=2220, 2026-07=1285 before and after), because seed data bookings never reach `APPROVED` (all ≤3.75h, so `requiresApproval` is always false) — so this gap doesn't currently affect any historical invoice.
