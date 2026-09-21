# ภาพประกอบสำหรับแปะลงสไลด์

**พื้นหลังโปร่งใส** ลากวางบนสไลด์พื้นขาวหรือพื้นอ่อนได้เลย ไม่มีกรอบสี่เหลี่ยมโผล่

ภาพพวกนี้เป็น **ภาพประกอบอย่างเดียว** ไม่มีหัวเรื่อง ไม่มีคำบรรยายใต้หัว
และไม่มีแถบสรุปท้ายภาพ — **หัวข้อกับข้อสรุปใส่เองบนสไลด์**
(หัวข้อที่ควรใช้ เขียนไว้แล้วใน `progress2/SLIDES.md`)

| ไฟล์ | สไลด์ | แสดงอะไร | ขนาด |
|---|---|---|---|
| `fig-retro-impact.png` | **1** | สไลด์เปิด — S08 แก้ 1 บรรทัด แล้วใบแจ้งหนี้ย้อนหลังเปลี่ยน | 1360 × 468 |
| `fig-fixture.png` | 3 | สนามทดลอง ระบบจอง GPU — ระบบทำอะไร โค้ดกี่ไฟล์ เอกสารอะไรบ้าง | 1420 × 470 |
| `fig-scenarios.png` | 4 | โจทย์ 11 ข้อ คำสั่งจริง กับดัก และอัตราทำสำเร็จ | 1500 × 690 |
| `fig-arms.png` | 5 | **context และ skill ที่ใส่ให้แต่ละกลุ่มจริง** | 1520 × 560 |
| `fig-same-rule.png` | 6 | กฎข้อเดียวกันในรูป CLAUDE.md กับรูป SKILL.md | 1460 × 640 |
| `fig-how-we-measure.png` | **7** | **ให้คะแนนยังไง** — หลักฐานที่เก็บ · กฎที่ตรวจ · สอง run จริง | 1600 × 455 |
| `fig-runs-map.png` | 8 | แผนที่ 396 run ทั้งสองรอบ | 1420 × 340 |
| `fig-effort.png` | 8 | แถบตัวเลขต้นทุน — วางเหนือ `fig-runs-map` | 1340 × 130 |
| `fig-scenario-diff.png` | 10 | ผลต่างรายโจทย์ 11 แท่ง เห็นว่า 6 ข้อเสมอ | 1140 × 530 |
| `fig-p-floor.png` | 10 | นับโจทย์ที่ให้ข้อมูล = 5 · เพดาน 0.0625 · เทียบสองรอบ | 1270 × 330 |
| `fig-tradeoff.png` | 11 | ทำงานสำเร็จ เทียบ ตามกฎ พร้อมกล่องข้อจำกัด | 1420 × 400 |

## ทุกตัวเลขมาจากข้อมูลจริง

| ภาพ | ที่มา |
|---|---|
| `fig-arms` | นับตัวอักษรจาก `arms/**` |
| `fig-same-rule` | คัดข้อความจาก `arms/A1/CLAUDE.md` §4 และ `arms/A2/skills/impact-analysis/SKILL.md` |
| `fig-fixture` | นับจาก `fixtures/gpu-booking/**` · เทส 34 ตัวจาก `npm run fixture:test` |
| `fig-retro-impact` | ยืนยันด้วยการแก้ `Math.ceil` เป็น `Math.floor` ที่ `lib/duration.ts` แล้วรันจริง |
| `fig-scenarios` | `scenarios/*.json` · อัตราสำเร็จจาก `results-study2/latest.json` |
| `fig-how-we-measure` | กฎจาก `scenarios/S08-rounding-change.json` · สอง run จริงจาก `results-study2/latest.json` |
| `fig-scenario-diff` · `fig-p-floor` | `results-study2/latest.json` |
| `fig-runs-map` · `fig-effort` | **สร้างจากข้อมูลด้วยสคริปต์** |
| `fig-tradeoff` | `results-study2/numbers.json` |

## ถ้าเด็คเป็นธีมมืด

ตอนนี้ตัวหนังสือเป็นสีเข้ม สำหรับวางบนพื้นขาว
ถ้าจะใช้กับสไลด์พื้นมืด ให้สลับค่าสีใน `../src/_fig.css` **บล็อก `:root` บล็อกเดียว**
แล้วเรนเดอร์ใหม่ทั้งชุด ไม่ต้องแก้ไฟล์ภาพทีละไฟล์

## สร้างใหม่

`fig-runs-map.html` และ `fig-effort.html` **ห้ามแก้ด้วยมือ** — สร้างจากข้อมูล

```bash
bash slides-images/src/render-figures.sh
```

สคริปต์นั้นเรียก `fig-runs.gen.mjs` ให้เอง แล้วเรนเดอร์ทุกภาพในชุด
