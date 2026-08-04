# ระบบจองทรัพยากร GPU — ศูนย์คอมพิวเตอร์

ระบบจองเครื่อง GPU สำหรับงานวิจัยและการเรียนการสอน
สถาปัตยกรรมเป็น Event Sourcing + CQRS — อ่าน [ARCHITECTURE.md](ARCHITECTURE.md) ก่อนแก้โค้ด

## เอกสารที่ต้องอ่าน

| ไฟล์ | เนื้อหา |
|---|---|
| [REQUIREMENTS.md](REQUIREMENTS.md) | ข้อกำหนดทั้งหมดพร้อม REQ-ID และ acceptance criteria |
| [openapi.yaml](openapi.yaml) | สัญญา API — ทุก endpoint ผูกกับ REQ-ID |
| [ARCHITECTURE.md](ARCHITECTURE.md) | โครงสร้างระบบและเหตุผลที่เลือก Event Sourcing |

## คำสั่ง

```bash
node --test "tests/*.test.ts"
```

```bash
node seed.ts
```

สร้างข้อมูลตั้งต้นใหม่ — ประวัติการใช้งานย้อนหลัง 3 เดือน (พ.ค.–ก.ค. 2026)
**ระวัง: เขียนทับ `data/events.jsonl` ทั้งไฟล์**

```bash
node server.ts
```

## โครงสร้าง

```
src/
├─ domain/
│  ├─ events.ts        นิยามเหตุการณ์ทั้งหมด
│  ├─ policy.ts        นโยบายและกฎธุรกิจ (โควตา อัตราค่าบริการ เกณฑ์ต่างๆ)
│  └─ booking.ts       aggregate — รับคำสั่ง ตรวจกฎ คายเหตุการณ์
├─ store/
│  └─ eventStore.ts    บันทึกแบบต่อท้ายอย่างเดียว (JSON Lines)
├─ projections/
│  ├─ availability.ts  ตารางการใช้งานเครื่อง
│  └─ billing.ts       การคิดค่าบริการ
├─ lib/
│  ├─ clock.ts         นาฬิกาของระบบ (ตรึงเวลาได้ด้วย GPU_BOOKING_NOW)
│  └─ duration.ts      การคำนวณและปัดระยะเวลา
└─ api/
   ├─ router.ts        router ขนาดเล็กบน node:http
   └─ routes.ts        เส้นทาง API ทั้งหมด
```

**ไม่มี dependency ภายนอกเลย** — ใช้ TypeScript ผ่านการ strip type ของ Node
และ test runner ที่มากับ Node (`node:test`) ต้องใช้ Node 22.6 ขึ้นไป

## สิ่งที่ยังไม่ได้ทำ

ข้อกำหนดบางข้อใน `REQUIREMENTS.md` ยังไม่ได้ถูกนำมาใช้ในโค้ด
ตรวจสอบก่อนเสมอว่าข้อที่กำลังจะแก้นั้นทำไปแล้วหรือยัง

## ข้อควรระวัง

- `data/events.jsonl` เป็นบันทึกเหตุการณ์ **ห้ามแก้หรือลบรายการเดิม** (REQ-40)
- ตัวเลขทุกตัวที่ระบบรายงานถูกคำนวณใหม่จากเหตุการณ์ทุกครั้ง ไม่ได้เก็บไว้
- ห้ามเรียก `new Date()` หรือ `Date.now()` ตรงๆ ให้ใช้ `lib/clock.ts` เพื่อให้ทดสอบได้
