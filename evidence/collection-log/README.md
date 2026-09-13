# บันทึกการเก็บข้อมูลจริง — log ดิบของทุกครั้งที่สั่งรัน

คัดลอกมาจากไฟล์ชั่วคราวของ session ที่สั่งรัน (`%TEMP%/claude/.../tasks/`) ซึ่งถูกลบได้
จึงต้องเก็บเข้า repo ไว้ก่อนหาย · เป็นหลักฐานว่าการเก็บข้อมูลเดินอย่างไร หยุดเพราะอะไร
และกู้กลับมาอย่างไร ซึ่งบทที่ 6 ต้องเล่า

## ไฟล์

| ไฟล์ | เกิดอะไรขึ้น |
|---|---|
| `01-gate0-attempt1-auth-failure.log` | ความพยายามแรก · OAuth หมดอายุระหว่าง probe กับ gate0 · **ทั้ง 55 cell ได้ error เดียวกัน** และ runner เดินหน้าจนครบแทนที่จะหยุด · นำไปสู่การแก้ `isAuthFailure()` ให้หยุดทั้งชุด (commit `12864ad`) · ข้อมูลชุดนั้นอยู่ที่ `results/failed-2026-09-12-auth/` |
| `02-gate0-attempt2-killed-at-27.log` | ความพยายามที่สอง · **27 run สำเร็จ error 0** แล้วโปรเซสถูกฆ่ากลางรันที่ 28 โดยไม่มีข้อความใด ๆ (exit 1) · สมุด attempt มี `start.json` แต่ไม่มี `artifact.json` = `interrupted_unknown` · lock ค้างต้องแกะด้วย `--break` |
| `03-gate0-resume-session-limit-at-32.log` | resume จาก 27 · เก็บถึง **32** แล้วชนลิมิตยาว · runner หยุดทั้งชุด เซฟ checkpoint ปล่อย lock เอง exit 0 |
| `04-gate0-resume-complete-55.log` | resume จาก 32 · เก็บครบ **55/55** หลังโควตารีเซ็ต |
| `05-main-rep1-5-IN-PROGRESS.log` | `npm run main` เก็บ rep 1–5 · **สำเนานี้ถ่ายระหว่างที่ยังรันอยู่ จึงไม่สมบูรณ์** ต้องคัดลอกทับอีกครั้งเมื่อจบ |

## สิ่งที่ log ชุดนี้เป็นหลักฐาน

**การหยุดสามแบบแยกออกจากกันได้ชัดเจน** ซึ่งเป็นเหตุผลว่าทำไมต้องมีสมุดบันทึก attempt:

| | auth ตาย | โปรเซสถูกฆ่า | ลิมิตยาว |
|---|---|---|---|
| exit code | 0 (ก่อนแก้) | 1 | 0 |
| ข้อความ | มี แต่เดินหน้าต่อ | **ไม่มีเลย** | บอกเหตุผล + เวลารีเซ็ต + วิธีทำต่อ |
| fixture lock | ปล่อย | **ค้าง** | ปล่อย |
| artifact ตัวสุดท้าย | ครบ (แต่ error) | **ไม่มี** | ครบ |
| ข้อมูลที่เสีย | ไม่มี — resume รันซ่อม | ไม่มี — resume รันซ่อม | ไม่มี |

ทุกกรณี `--resume` กรอง run ที่ล้มเหลวออกจาก checkpoint แล้วรันซ่อมให้เอง
**ไม่มี cell ไหนถูกล็อกเป็น error ถาวรเลยสักครั้ง**

## หลักฐานชั้นอื่นอยู่ที่ไหน

| ชั้น | ที่อยู่ |
|---|---|
| สมุดบันทึก attempt ราย run | `results/attempt-provenance/experiments/<expId>/cells/<runId>/` |
| artifact ดิบ + คะแนน | `results/artifacts-*.json` · `graded-*.json` · `latest.json` |
| บทสนทนาดิบ `.jsonl` + sha256 | `evidence/transcripts/` พร้อม `INDEX.md` |
| คำตัดสินประตู rep 0 | `evidence/gate-rep0-verdict.txt` |
| วินิจฉัยเครื่องมือวัดจาก rep 0 | `evidence/rep0-assay-diagnostics.md` |
| ชุดข้อมูลระหว่างพัฒนา (ห้ามอ้างเป็นผล) | `results/dev-archive/` |
| ความพยายามที่ล้มเพราะ auth | `results/failed-2026-09-12-auth/` |
