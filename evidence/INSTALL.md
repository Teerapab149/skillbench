# ติดตั้งระบบเก็บหลักฐาน

> ผู้ช่วยไม่ติดตั้งให้เอง เพราะสองอย่างในนี้แก้ config ระดับเครื่องของคุณ
> อ่านก่อนแล้วรันเองทีละขั้น

## ขั้นที่ 0 — ถ่ายสำเนาบทสนทนาออกมาก่อน (ทำได้เลย ไม่มีผลข้างเคียง)

หลักฐานที่ดีที่สุดมีอยู่แล้ว 23 MB แต่มันอยู่นอก repo และถูกลบได้

```bash
node scripts/evidence-archive.mjs
```

ดูรายการก่อน แล้วค่อยคัดลอกจริง:

```bash
node scripts/evidence-archive.mjs --copy
```

ได้ `evidence/transcripts/` พร้อม `INDEX.md` ที่มี sha256 ของทุกไฟล์

> ⚠️ ไฟล์พวกนี้มีบทสนทนาทั้งหมดรวมทุกอย่างที่เคยพิมพ์ **ตรวจก่อนตัดสินใจว่าจะ commit เข้า repo หรือเก็บไว้นอก repo** ค่าตั้งต้นตอนนี้คือ `.gitignore` กันไว้แล้ว

## ขั้นที่ 1 — เปิด ledger สำหรับ repo นี้

```bash
node -e "require('fs').writeFileSync('evidence/.ledger-enabled','')"
```

ไฟล์เปล่านี้คือสวิตช์ **hook จะเขียน ledger เฉพาะ repo ที่มีไฟล์นี้** fixture ไม่มี จึงไม่มีอะไรถูกเขียนระหว่างเก็บข้อมูลการทดลอง

## ขั้นที่ 2 — ทดสอบตัวเขียน ledger ก่อนติดตั้ง hook

ยิง event ปลอมเข้าไปดูว่าเขียนถูกไหม:

```bash
echo '{"hook_event_name":"UserPromptSubmit","cwd":"E:/Seminar/skillbench","prompt":"ทดสอบ"}' | node scripts/evidence-log.mjs && tail -1 evidence/ledger.jsonl
```

แล้วทดสอบ **ตัวกัน** ว่า fixture ไม่ถูกบันทึกจริง — คำสั่งนี้ต้องไม่เพิ่มบรรทัดใหม่:

```bash
wc -l < evidence/ledger.jsonl && echo '{"hook_event_name":"UserPromptSubmit","cwd":"E:/Seminar/skillbench/fixtures/gpu-booking","prompt":"ต้องไม่ถูกบันทึก"}' | node scripts/evidence-log.mjs && wc -l < evidence/ledger.jsonl
```

**ตัวเลขสองตัวต้องเท่ากัน** ถ้าไม่เท่า อย่าติดตั้ง hook

## ขั้นที่ 3 — ติดตั้ง hook

แก้ `~/.claude/settings.json` เพิ่มส่วน `hooks` เข้าไป (ถ้ามีอยู่แล้วให้รวมเข้ากับของเดิม อย่าเขียนทับ)

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "hooks": [ { "type": "command", "command": "node E:/Seminar/skillbench/scripts/evidence-log.mjs" } ] }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash|PowerShell|Edit|Write|NotebookEdit",
        "hooks": [ { "type": "command", "command": "node E:/Seminar/skillbench/scripts/evidence-log.mjs" } ]
      }
    ]
  }
}
```

> path เป็นแบบเต็มโดยตั้งใจ เพราะ hook ระดับผู้ใช้ทำงานในทุกโปรเจกต์ ไม่ใช่แค่ repo นี้
> ซึ่งตรงกับที่คุณต้องการ — ledger จะตามไปเก็บให้ทุกงาน แต่เขียนเฉพาะ repo ที่เปิดสวิตช์ไว้

## ขั้นที่ 4 — ยืนยันว่ามันทำงานจริง

เปิด session ใหม่ พิมพ์อะไรก็ได้ แล้วดู:

```bash
tail -3 evidence/ledger.jsonl
```

ถ้าไม่มีอะไรเพิ่ม แปลว่า hook ยังไม่ทำงาน — **อย่าเชื่อว่าติดตั้งสำเร็จเพราะไฟล์ config ถูกแก้แล้ว** โปรเจกต์นี้เจ็บมาสามครั้งจากตัวแปรที่ประกาศไว้แต่ไม่เคยมีผลจริง

---

## ก่อนเริ่มเก็บข้อมูลการทดลอง ให้ตรวจอีกรอบ

hook ระดับผู้ใช้ **อาจ** ทำงานตอนที่ runner เรียก CLI ด้วย `--setting-sources project` หรือไม่ก็ได้ — เรายังไม่ได้วัด และเรารู้อยู่แล้วว่า flag นี้เคยทำไม่ตรงกับที่เอกสารบอก

ตัวกันที่ขั้นที่ 1 ทำให้ต่อให้มันทำงาน ก็ไม่มีอะไรถูกเขียน แต่ยังเหลือต้นทุนคือ **การ spawn โปรเซส node เพิ่มต่อ tool call หนึ่งครั้ง** ซึ่งเท่ากันทุก arm แต่กินเวลาในงบ timeout

ถ้าอยากตัดความเสี่ยงนี้ให้เป็นศูนย์: **ถอด hook ออกก่อนสั่ง `npm run gate0` แล้วติดกลับหลังเก็บข้อมูลเสร็จ** ระหว่างนั้นบทสนทนาดิบยังถูกเก็บโดย Claude Code เองอยู่แล้ว หลักฐานไม่ขาดตอน
