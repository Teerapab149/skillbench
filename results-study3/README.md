# ชุดที่ 3 — ข้อมูลหลัก

- แผน: `PRE-REGISTRATION-3.md` ณ tag `study3-prereg` · ส่วนเบี่ยงเบน: `DEVIATIONS-3.md` (D1–D6)
- เก็บ 8–10 ต.ค. 2569 · 4 arm × 22 โจทย์ × **3 รอบ = 264 run** (กฎสำรอง clock-truncation, D6)
- วิเคราะห์: `npm run analyze:study3 -- --fallback-reps 3` → `report.md`, `numbers.json`, `summary.csv`
- การวิเคราะห์ความไว (ประกาศล่วงหน้า): `node scripts/study3/sensitivity.mjs` → `sensitivity.json`
- `artifacts-2026-10-10T03-33-40.json` / `graded-…` คือชุดสุดท้าย (สร้างจาก checkpoint ด้วย `--stop-after-rep 2` ไม่มี run ใหม่)
- ไม่อยู่ในรีโป: checkpoint, snapshot ระหว่างทาง, `attempt-provenance/` (เก็บบนดิสก์ผู้วิจัย)
- log การเก็บข้อมูล: `evidence/collection-log/study3.log` · memory ที่กักเก็บ: `evidence/memory-quarantine/`
