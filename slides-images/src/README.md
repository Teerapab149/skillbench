# ต้นฉบับของภาพสไลด์

ภาพใน `slides-images/` ที่มีไฟล์ `.html` ชื่อเดียวกันในโฟลเดอร์นี้ สร้างซ้ำได้ด้วย headless Chrome

**ต้องใช้ path เต็มของไฟล์ผลลัพธ์** ไม่งั้น Chrome จะเขียนไฟล์ไม่ได้ (Access is denied)

```bash
"C:/Program Files/Google/Chrome/Application/chrome.exe" --headless --disable-gpu \
  "--screenshot=E:\Seminar\skillbench\slides-images\20-arms-context.png" \
  --window-size=1600,812 --default-background-color=141519FF --hide-scrollbars \
  "file:///E:/Seminar/skillbench/slides-images/src/20-arms-context.html"
```

## ภาพชุดที่ใช้พรีเซนรอบที่ 2 (20–26)

| ไฟล์ | ขนาดหน้าต่าง | แสดงอะไร | ที่มาของตัวเลข |
|---|---|---|---|
| `20-arms-context.html` | 1600 × 812 | context/skill ที่ใส่ให้แต่ละกลุ่มจริง | นับตัวอักษรจาก `arms/**` |
| `21-same-rule.html` | 1600 × 830 | กฎข้อเดียวกันในรูป CLAUDE.md กับรูป skill | คัดจาก `arms/A1/CLAUDE.md` §4 และ `arms/A2/skills/impact-analysis/SKILL.md` |
| `22-fixture.html` | 1600 × 780 | สนามทดลอง ระบบจอง GPU | นับจาก `fixtures/gpu-booking/**` · เทส 34 ตัวจาก `npm run fixture:test` |
| `23-scenarios.html` | 1600 × 935 | โจทย์ 11 ข้อ คำสั่งจริง และกับดัก | `scenarios/*.json` · อัตราสำเร็จจาก `results-study2/latest.json` |
| `24-why-inconclusive.html` | 1600 × 972 | ผลต่างรายโจทย์ และที่มาของ m = 5 | `results-study2/latest.json` |
| `25-runs-map.html` | 1600 × 712 | แผนที่ 396 run ทั้งสองรอบ | **สร้างจากข้อมูลด้วย `25-runs-map.gen.mjs`** |
| `26-compliance-vs-completion.html` | 1600 × 748 | แยกคะแนนเป็นทำสำเร็จ กับ ตามกฎ | `results-study2/numbers.json` |

`25-runs-map.html` **ห้ามแก้ด้วยมือ** — สร้างใหม่ด้วย

```bash
node slides-images/src/25-runs-map.gen.mjs
```

## ภาพชุดเดิม (01–15) จากการพรีเซนรอบที่ 1

`04-five-arms.html` และ `07-compounding-v2.html` มีต้นฉบับ ที่เหลือไม่มี
ภาพที่ยังใช้ได้และตัวเลขยังตรง:

| ไฟล์ | ใช้ต่อได้ |
|---|---|
| `01-revenue-before.png` · `02-the-change.png` · `03-retroactive-impact.png` | ✅ เรื่องผลกระทบย้อนหลังของ S08 · ตัวเลข 2140→1925 ยืนยันแล้ว เทสตก 3/34 |
| `12-event-sourcing.png` · `13-trap-families.png` | ✅ อธิบายสนามทดลองและตระกูลกับดัก |
| `04-five-arms.png` | ⚠️ เป็นของรอบที่ 1 (5 กลุ่ม) รอบที่ 2 ใช้ `20-arms-context.png` แทน |
| `14-collection-status.png` · `15-roadmap.png` | ⛔ ตัวเลขเก่า ห้ามใช้ |

สไตล์: พื้น `#141519` · ฟอนต์ Leelawadee UI + Cascadia Mono · กว้าง 1600px
