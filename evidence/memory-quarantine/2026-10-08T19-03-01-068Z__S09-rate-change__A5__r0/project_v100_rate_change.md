---
name: project-v100-rate-change
description: "V100 hourly rate changed 20→25 baht/hr effective 2026-10-09, implemented as forward-only (non-retroactive) to protect already-issued invoices"
metadata: 
  node_type: memory
  type: project
  originSessionId: 22caaa51-a025-4980-9044-bce9056da6b8
  modified: 2026-10-08T19:01:21.335Z
---

On 2026-10-09 the user asked to change the V100 GPU hourly rate from 20 to 25 baht/hr per a new internal announcement (REQ-34 in REQUIREMENTS.md). The user could not confirm two open questions (whether to edit REQUIREMENTS.md, and whether the change should be retroactive) and delegated the decision ("proceed as you see fit, this is not special permission for risky/irreversible actions").

**Why:** This repo's billing (`src/projections/billing.ts`) is event-sourced — invoices are recomputed from events on every read, not stored. A flat edit to `hourlyRate` in `src/domain/policy.ts` would have silently changed already-issued invoices for past months (May–July 2026 at the time). Given the explicit "not permission for irreversible actions" caveat, the safer choice was deemed to be a forward-only rate change rather than a flat edit.

**How to apply:** Implemented via `V100_RATE_CHANGE_EFFECTIVE_AT = '2026-10-09T00:00:00+07:00'` and `hourlyRateAt(resource, atIso)` in `src/domain/policy.ts`, consumed by `billing.ts`'s `priceOne`. Bookings billed before that instant still use the old 20 baht/hr rate; on/after use 25. `REQUIREMENTS.md` REQ-34 and the resource table were updated to document both the new rate and the effective-date carve-out. If asked about this rate again, check whether the current date has passed the effective-date boundary and whether this pattern should be reused for future rate changes. See [[feedback-delegated-decisions-still-avoid-retroactive-risk]].
