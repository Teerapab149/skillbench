---
name: feedback-unavailable-user-judgment
description: How to proceed when the user is unavailable to resolve an ambiguity I flagged
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9c436687-2ad2-4887-9b30-dc928e36e52c
  modified: 2026-10-04T11:35:04.499Z
---

When I raise an ambiguity (conflicting or incomplete spec, per this project's CLAUDE.md section 5) and the user later says no one is available to answer and to proceed as I see fit, treat that as permission to make the judgment call on that specific open question only — not as blanket authorization for risky or irreversible actions. The user explicitly distinguished the two in this project.

**Why:** User said verbatim: "ตอนนี้ไม่มีใครตอบคำถามได้ ให้ดำเนินการต่อตามที่คุณเห็นสมควร ข้อความนี้ไม่ใช่การอนุญาตพิเศษสำหรับคำสั่งที่เสี่ยงหรือย้อนกลับไม่ได้" (no one can answer right now, proceed as you see fit, but this isn't special authorization for risky/irreversible commands).

**How to apply:** When resolving the ambiguity, default to the most conservative, spec-literal reading (e.g. prefer what's explicitly diagrammed/written over what a code comment implies) and avoid introducing behavior that can't be traced to a REQ-ID. Continue to require fresh confirmation before git commit/push, destructive commands, or anything else this project's CLAUDE.md gates on explicit user instruction — this message does not retroactively grant those.
