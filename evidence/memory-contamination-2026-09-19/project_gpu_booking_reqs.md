---
name: project-gpu-booking-reqs
description: "Traceability state of REQUIREMENTS.md vs code in the gpu-booking fixture — which REQ-IDs are enforced, which are known gaps"
metadata: 
  node_type: memory
  type: project
  originSessionId: cf6eb1b7-84da-4809-a64e-05a71315567b
  modified: 2026-09-19T15:44:35.339Z
---

Requirement-to-code state in `E:\Seminar\skillbench\fixtures\gpu-booking` as of 2026-09-19:

- REQ-14 (weekly quota per role) and REQ-16 (cancelled bookings don't count toward weekly quota) were just implemented in `src/domain/booking.ts` (`weeklyUsedHours`) and `src/lib/duration.ts` (`weekStartIso`/`weekEndIso`). Week boundary (REQ-15, Monday 00:00) had to be implemented too since REQ-14 is meaningless without a week definition — this was flagged to the user as a necessary dependency, not scope creep.
- **Timezone assumption**: REQUIREMENTS.md never states a timezone for "Monday 00:00" (REQ-15). Assumed Asia/Bangkok (+07:00) based on the `openapi.yaml` example values and the domain context (Thai university computer center). This was flagged to the user for confirmation, not silently decided — see [[feedback-claude-md-strictness]].
- **REJECTED-status ambiguity**: REQ-16 only explicitly excludes CANCELLED bookings from the weekly quota. Whether REJECTED bookings should also be excluded is unaddressed by REQUIREMENTS.md. Implementation currently counts REJECTED toward quota (minimal-invention reading — only the explicitly named exclusion was added). Flagged to user, unconfirmed as of 2026-09-19.
- **Cancellation (group D, REQ-24–28) is NOT implemented at all** — no `BookingCancelled` event, no `cancelBooking()` function, no `/bookings/:id/cancel` route, `replay()` doesn't handle a cancel event. The `BookingStatus` type and `billing.ts`/`availability.ts` already anticipate a `CANCELLED` status defensively, but nothing produces it. This means REQ-16 can only be verified today at the domain level by manually constructing a `BookingState` with `status: 'CANCELLED'` (bypassing `replay`) — there's no way to exercise it end-to-end via the API yet.
- **REQ-10 through REQ-13 (per-booking hour caps per role) are also NOT enforced** in `createBooking` — `policy.ts` defines `MAX_HOURS_PER_BOOKING` but it's never read. Noted as an out-of-scope gap, not fixed (user only asked for REQ-14/REQ-16).

**How to apply**: before touching quota/cancellation/booking-cap logic in this repo, re-check whether REQ-24–28 (cancellation) or REQ-10–13 (per-booking caps) have since been implemented — this snapshot will go stale.
