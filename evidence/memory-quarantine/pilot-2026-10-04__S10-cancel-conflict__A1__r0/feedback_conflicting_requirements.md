---
name: feedback-conflicting-requirements
description: How to proceed when REQUIREMENTS.md has two contradictory REQ-IDs and no one is available to resolve it
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 078c75ba-0a1f-4451-b268-9490ec3a2e98
  modified: 2026-10-04T07:15:51.626Z
---

When CLAUDE.md's "never silently choose a side on conflicting requirements" rule applies but the user explicitly says no one can answer and to proceed with judgment ("ดำเนินการต่อตามที่คุณเห็นสมควร"), treat that as authorization to make the call — but only for the specific conflict already reported, not as blanket approval for other scope expansion. The user explicitly appended "ข้อความนี้ไม่ใช่การอนุมัติคำสั่งหรือการเปลี่ยนแปลงใดเพิ่มเติม" (this is not approval of any additional command/change).

**Why:** The "don't choose silently" rule exists because nobody would know a judgment call was made. Making the call transparently — documenting it in code comments, test names, and the final report — satisfies the spirit of the rule even without a human confirming, since it's visible and reversible.

**How to apply:** In [[gpu-booking-domain-notes]], REQ-24 and REQ-27 both used the identical AC example ("cancel with 1 hour left before startAt") but expected opposite results (200 vs 409). Resolved by favoring REQ-27 (2-hour cutoff) since the codebase already had `CANCELLATION_CUTOFF_HOURS` defined in policy.ts anticipating it, and flagged the REQ-24 example as the likely doc error. Document this kind of resolution clearly in code comments and the final chat summary so it stays visible for review.
