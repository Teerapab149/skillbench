# สไลด์ภาษาอังกฤษ (ใช้คู่กับการพูดภาษาไทย)

ฉบับที่ใช้นำเสนอ 22 ต.ค. 2569 คือ `presentation-final/SkillBench-final-EN.pptx` (20 หน้า หลัก 14 หน้า สำรอง 6 หน้า) ลำดับและเนื้อหาตรงกับชุดไทย `SkillBench-final-TH.pptx` ทุกหน้า ข้อความบนสไลด์เป็นภาษาอังกฤษ ส่วนบทพูดใน notes เป็นภาษาไทย เพราะผู้นำเสนอพูดไทย

ไฟล์ในโฟลเดอร์นี้สร้างจาก `deck-th` ด้วยสคริปต์ ห้ามแก้ตรงนี้ ให้แก้ที่ชุดไทยหรือที่คำแปลแล้วสร้างใหม่

1. `node presentation-final/src/make-figures.mjs --en` สร้างรูปภาษาอังกฤษ (ไฟล์ลงท้าย `-en`)
2. `node presentation-final/src/deck-build/make-en.mjs` แปลข้อความบนสไลด์ คำแปลทั้งหมดอยู่ในไฟล์นี้ ถ้ายังมีภาษาไทยเหลือบนสไลด์ สคริปต์จะแจ้ง
3. `node presentation-final/src/deck-build/build-preview.mjs --en` แล้ววัดตำแหน่งด้วย `measure.js` ตามขั้นตอนใน `deck-th/README.md`
4. `node build-pptx.js --en` ได้ `SkillBench-final-EN.pptx`

สคริปต์พูดภาษาอังกฤษทั้งชุดอยู่ที่ `presentation-final/SCRIPT-EN.md`
