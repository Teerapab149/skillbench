# สไลด์ภาษาไทยฉบับ final

ฉบับที่ใช้นำเสนอ 22 ต.ค. 2569 คือ `presentation-final/SkillBench-final-TH.pptx` (20 หน้า หลัก 14 หน้า สำรอง 6 หน้า) ซึ่งสร้างจากไฟล์ในโฟลเดอร์นี้ และนำเข้า Canva ต่อ รายการตรวจใน Canva อยู่ที่ `presentation-final/CANVA-CHECKLIST.md`

สไลด์บน claude.ai (https://claude.ai/artifact/TxyptBuuYHmvmS84ZVQxLV) เป็นฉบับก่อน 17 ต.ค. ยังใช้ลำดับ 19 หน้าแบบเดิมและรูปกราฟเก่า ไม่ได้อัปเดตตาม และไม่ควรใช้นำเสนอ

## ไฟล์ในโฟลเดอร์นี้

- `deck.json` ลำดับสไลด์และหมวด
- `slides/*.html` สไลด์ทีละหน้า บทพูดอยู่ในแท็ก `<aside>` ท้ายไฟล์ บรรทัดแรกของบทพูดบอกว่าใครพูดและใช้เวลาเท่าไร ย่อหน้าที่ขึ้นต้นด้วย "ถ้าถูกถาม" คือคำตอบเตรียมไว้ ไม่ต้องพูด
- `preview.html` ทุกหน้าต่อกัน สร้างจาก `slides/` ใช้วัดตำแหน่งก่อนสร้าง pptx
- รูปที่สไลด์อ้างด้วย `/_blob/…` คือรูปบน claude.ai ส่วนรูปที่อ้างด้วย `../../figures/` อยู่ใน `presentation-final/figures/` ทั้งสองแบบสร้างจาก `presentation-final/src/make-figures.mjs`

## สร้าง pptx และบทพูดใหม่หลังแก้สไลด์

สคริปต์อยู่ใน `presentation-final/src/deck-build/` บางไฟล์ยังเขียนตำแหน่งโฟลเดอร์ชั่วคราวบนเครื่องผู้วิจัยไว้ตรง ๆ ต้องแก้ path ก่อนใช้บนเครื่องอื่น

1. `node presentation-final/src/make-figures.mjs` ถ้าแก้รูป
2. `node build-preview.mjs` สร้าง `preview.html` ใหม่
3. เปิด `preview.html` ผ่าน `serve.js` (พอร์ต 4390) แล้วรัน `measure.js` ในหน้าเว็บ ได้ `layout.json`
4. `node build-pptx.js` (ต้องติดตั้ง pptxgenjs 3.12.0) ได้ `SkillBench-final-TH.pptx` พร้อมบทพูดใน notes
5. `node script.mjs` ได้ `presentation-final/SCRIPT-TH.md` และ `script-pdf.mjs` กับ `fit2.mjs` ได้ `SCRIPT-TH.pdf` สำหรับอ่านบนมือถือ (ไฟล์ PDF ไม่เข้า git)
