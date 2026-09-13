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
| `05-main-from-55-killed-at-68.log` | `npm run main` ครั้งแรก · เก็บถึง **68** แล้วโปรเซสถูกฆ่าเงียบ ๆ อีกครั้ง (exit 1 ไม่มีข้อความ) · ครั้งนี้เดินได้ 38 นาที ไม่ใช่ 62 จึงไม่ใช่อายุคงที่ |
| `06-main-from-68-session-limit-at-86.log` | resume จาก 68 · เก็บถึง **86** แล้วชนลิมิตยาว (reset 18:10 น.) · หยุดสะอาด ปล่อย lock เอง |
| `07-main-from-86-handover-at-94.log` | resume จาก 86 · เก็บถึง **94** แล้ว**ผู้วิจัยขอรับช่วงไปรันเองในเทอร์มินัลตัวเอง** · ผู้ช่วยหยุด background task ปิด runner ที่ยังลอยอยู่ (pid 29544 พร้อม child) แกะ lock และส่งมอบ |
| `08-main-terminal.log` | การรันจากเทอร์มินัลของผู้วิจัยเอง · resume จาก 94 · **หยุดทันทีที่ run แรก** เพราะ `validateRuntime` พบ baseline skill set เป็น 15 ไม่ใช่ 18 ที่ตรึงไว้ · run นั้นถูกปฏิเสธ ไม่เข้า dataset · ดูหัวข้อ "ปัญหาการเข้ารหัสของ log" ด้านล่าง |
| `06-main-terminal.log` | **ไฟล์ซ้ำ ตั้งเลขผิด** — เป็นการบันทึกเหตุการณ์เดียวกันกับ `08-main-terminal.log` (หยุดที่ 94 เพราะ 15 vs 18) ที่เซฟไว้ก่อนหน้า เก็บไว้โดยไม่แก้ไขเพื่อไม่แตะหลักฐาน |
| `09-main-detached.log` | resume จาก 111 · ยิงแบบ **detached** ด้วย `Start-Process` (pid 3936) แทน background task ของ session · เก็บถึง **120** แล้วชนลิมิตยาว (reset 23:10 น.) หยุดสะอาด · **ไม่ถูกฆ่าเงียบ** |
| `10-main-detached-2.log` | resume จาก 120 หลังโควตารีเซ็ต · detached เช่นกัน (pid 13764) |

## ปัญหาการเข้ารหัสของ log ที่บันทึกจากเทอร์มินัลผู้วิจัย

`06-main-terminal.log` และ `08-main-terminal.log` อ่านภาษาไทยไม่ออก เพราะบันทึกผ่าน
`Tee-Object` ของ Windows PowerShell 5.1 ซึ่งเขียนไฟล์เป็น UTF-16LE และตัวอักษรไทย
ถูกแปลงด้วย console codepage ไปแล้วก่อนถึง tee จึงเสียสองชั้น กู้กลับไม่ได้
(`Tee-Object` ของ PS 5.1 ไม่มีพารามิเตอร์ `-Encoding` — มีตั้งแต่ PS 6)

**เนื้อหาไม่สูญหาย** — ข้อความอังกฤษและตัวเลขยังอ่านได้ครบ และเหตุการณ์ที่ log นี้บันทึก
(หยุดเพราะ baseline skill 15 vs 18) มีบันทึกเต็มอยู่ใน `report/ch6-limitations-draft.md`

log ตั้งแต่ `09` เป็นต้นไปเขียนผ่าน `Start-Process -RedirectStandardOutput` ซึ่งส่ง byte
ผ่านตรงและได้ UTF-8 ถูกต้อง

## การส่งมอบไป–กลับ และวิธียิงที่ใช้ได้จริง

**13 ก.ย. 2569 ที่ 94/330 — ส่งมอบให้ผู้วิจัยรันเอง** เพราะ background task ของ session
ผู้ช่วยถูกฆ่าเงียบ ๆ สองครั้ง (ที่ 27 และที่ 68) การรันจากเทอร์มินัลของผู้วิจัยเอง
ไม่ขึ้นกับอายุ session นั้น

ข้อควรรู้ที่พบตอนส่งมอบ: `TaskStop` หยุดได้แค่ตัวห่อ `npm` — โปรเซส `node runner.mjs`
ตัวจริงยังทำงานต่อและยังถือ fixture lock อยู่ ต้องปิดด้วย `taskkill /PID <pid> /T /F`
แล้วแกะ lock ด้วย `node scripts/fixture-lock.mjs --break` จึงจะส่งมอบได้จริง

**13 ก.ย. 2569 ที่ 111/330 — รับกลับมา ยิงแบบ detached** ผู้วิจัยเจอปัญหาการรันเอง
(log อ่านไม่ออก และ CLI ตัดการทำงาน) จึงขอให้ผู้ช่วยรันต่อ วิธีที่ใช้คือไม่ยิงผ่าน
background task ของ session แต่แยกโปรเซสออกไปเลย:

```powershell
Start-Process -FilePath 'node' `
  -ArgumentList 'src/runner.mjs','--adapter','claude-cli','--reps','6','--resume' `
  -WorkingDirectory 'E:\Seminar\skillbench' `
  -RedirectStandardOutput 'evidence\collection-log\<n>-main-detached.log' `
  -RedirectStandardError  'evidence\collection-log\<n>-main-detached.err' `
  -WindowStyle Hidden -PassThru
```

**วิธีนี้แก้ปัญหาการถูกฆ่าเงียบได้** — การยิงแบบ detached สองครั้งแรกไม่ถูกฆ่าเลย
ครั้งที่หนึ่งเดินจนชนลิมิตยาวแล้วหยุดสะอาดเอง สาเหตุของการถูกฆ่าจึงอยู่ที่อายุของ
background task ของ session ไม่ใช่ที่ตัว runner หรือที่ I/O ในโฟลเดอร์

## สิ่งที่ log ชุดนี้เป็นหลักฐาน

**การหยุดสี่แบบแยกออกจากกันได้ชัดเจน** ซึ่งเป็นเหตุผลว่าทำไมต้องมีสมุดบันทึก attempt:

| | auth ตาย | โปรเซสถูกฆ่า | ลิมิตยาว | สภาพ runtime เพี้ยน |
|---|---|---|---|---|
| exit code | 0 (ก่อนแก้) | 1 | 0 | 1 |
| ข้อความ | มี แต่เดินหน้าต่อ | **ไม่มีเลย** | บอกเหตุผล + เวลารีเซ็ต + วิธีทำต่อ | บอกว่าอะไรไม่ตรง |
| fixture lock | ปล่อย | **ค้าง** | ปล่อย | ปล่อย |
| artifact ตัวสุดท้าย | ครบ (แต่ error) | **ไม่มี** | ครบ | ไม่มี — ปฏิเสธก่อนรัน |
| ข้อมูลที่เสีย | ไม่มี — resume รันซ่อม | ไม่มี — resume รันซ่อม | ไม่มี | ไม่มี |

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
