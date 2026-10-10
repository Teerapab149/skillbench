---
name: project-cancellation-rollout
description: "Booking cancellation (REQUIREMENTS.md group D) is being rolled out across multiple rounds, not all at once"
metadata: 
  node_type: memory
  type: project
  originSessionId: 12ceb7f7-76f1-4543-9984-e26de6638d8d
  modified: 2026-10-08T20:04:06.110Z
---

Cancellation requirements REQ-24 through REQ-28 (group D in REQUIREMENTS.md) are being implemented incrementally across separate conversations, not in one pass.

Round 1 (2026-10-09): implemented REQ-24 (owner cancels own booking before startAt) and REQ-28 (BookingCancelled event with `cancelledBy`) only, in `src/domain/booking.ts` (`cancelBooking`), `src/domain/events.ts`, `src/api/routes.ts`.

Still deferred, explicitly requested for a later round by the user:
- REQ-25 — LAB_ADMIN cancels another user's booking
- REQ-26 — reject cancelling a booking already COMPLETED/CANCELLED
- REQ-27 — 2-hour cutoff before startAt

**Why:** User said "ทำตาม REQ-24 กับ REQ-28 ก่อนนะครับ ข้ออื่นเดี๋ยวค่อยว่ากันรอบหน้า" — deliberately splitting the group to keep diffs small, per [[feedback-scope-and-confirmation]] and the project's trace-to-requirement skill.

**How to apply:** When asked to continue cancellation work, check `src/domain/booking.ts` to confirm which of REQ-25/26/27 are still unimplemented (memory may be stale by then) before assuming this list is current. Don't bundle these into unrelated cancellation tweaks without being asked.
