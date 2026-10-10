---
name: feedback-scope-and-confirmation
description: "How this user wants ambiguous-requirement questions handled when they can't respond, vs. authorization for risky actions"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 12ceb7f7-76f1-4543-9984-e26de6638d8d
  modified: 2026-10-08T20:03:56.186Z
---

When I flag an assumption/open question about an ambiguous requirement (per [[trace-to-requirement]] / acceptance-first skill) and the user replies that nobody is available to answer and I should "proceed as I see fit," that means: finalize the judgment call I already proposed and move on — don't keep blocking on it. It does **not** expand task scope and does **not** authorize risky or irreversible actions (git commit/push, destructive ops, etc.) — the user explicitly said so in that message.

**Why:** User is scope-disciplined (see CLAUDE.md: "ทำเฉพาะสิ่งที่ผู้ใช้ขอ") and distinguishes between "resolve this ambiguity yourself" and "you now have blanket approval." They called this out explicitly rather than letting it be assumed.

**How to apply:** Treat such a message as closing out open questions with my stated default, not as a green light for anything beyond the originally-requested REQ-IDs/task. Still ask/confirm separately before git commit, push, or other risky ops even after this kind of message.
