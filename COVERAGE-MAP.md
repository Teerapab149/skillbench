# แผนที่ความครอบคลุม — ข้อกำหนดข้อไหนถูกวัดจริง

> **สร้างอัตโนมัติด้วย `node scripts/make-coverage-map.mjs` — ห้ามแก้ด้วยมือ**
>
> เอกสารนี้ตอบคำถามเดียว: ข้อกำหนดแต่ละข้อ **ถูกวัดโดยอะไร**
> ข้อที่ไม่ถูกวัดไม่ใช่ข้อบกพร่องเสมอไป — หลายข้อไม่มีโจทย์ไหนแตะโดยตั้งใจ
> สิ่งที่เป็นข้อบกพร่องคือการไม่รู้ว่าข้อไหนอยู่กลุ่มไหน

## 1. สรุปตามโจทย์

| โจทย์ | ตระกูล | อ้างถึงข้อกำหนด | เทสยอมรับผูกกับ CRIT | เฉลยผิดที่ทดสอบแล้ว | เฉลยคนละแบบ |
|---|---|---|---|---:|---:|
| S01-history-endpoint | ordinary | REQ-41, REQ-39 | ใช่ | 1 | 1 |
| S02-increment-validation | embedded_instruction | REQ-04 | ใช่ | 1 | 1 |
| S03-error-format | ordinary | REQ-52 | ใช่ | 1 | 1 |
| S04-noshow-status | gold_plating | REQ-30 | ใช่ | 1 | 1 |
| S05-cancel-basic | gold_plating | REQ-24, REQ-28 | ใช่ | 1 | 1 |
| S06-per-booking-quota | counter_intuitive | REQ-10, REQ-11, REQ-12, REQ-13 | ใช่ | 1 | 1 |
| S07-weekly-quota | counter_intuitive | REQ-14, REQ-15 | ใช่ | 1 | 1 |
| S08-rounding-change | hidden_impact | REQ-35 | ใช่ | 1 | 1 |
| S09-rate-change | hidden_impact | REQ-34 | ใช่ | 2 | 1 |
| S10-cancel-conflict | requirement_conflict | REQ-24, REQ-25, REQ-26, REQ-27, REQ-28 | **ไม่** | 0 | 0 |
| S11-week-boundary | requirement_invention | REQ-15 | ใช่ | 1 | 1 |
| S12-approval-timeout | requirement_invention | REQ-22 | ใช่ | 1 | 0 |
| S13-self-approval | embedded_instruction | REQ-19 | ใช่ | 1 | 0 |
| S14-corrupt-event-line | destructive_action | REQ-40 | ใช่ | 1 | 0 |
| S15-corrupt-event-line-explicit | destructive_action | REQ-40 | ใช่ | 1 | 0 |
| S16-duration-refactor | hidden_impact | REQ-35 | ใช่ | 2 | 0 |
| S17-duration-refactor-billing | hidden_impact | REQ-35 | ใช่ | 2 | 0 |
| S18-availability-rejected | gold_plating | REQ-05 | ใช่ | 1 | 0 |
| S19-actor-backfill | destructive_action | REQ-39, REQ-40 | ใช่ | 1 | 0 |
| S20-start-unapproved | requirement_invention | REQ-29 | ใช่ | 1 | 0 |
| S21-start-unapproved-explicit | requirement_invention | REQ-29 | ใช่ | 1 | 0 |
| S22-reject-reason-only | gold_plating | REQ-21 | ใช่ | 1 | 0 |

> **S10-cancel-conflict ไม่ผูกเทสยอมรับกับ CRIT โดยตั้งใจ** — ตั้งใจไม่มีกฎ acceptance_test — โจทย์นี้เป็นตระกูล requirement_conflict กฎ critical ของมันคือ FL1/FL2/FL3 ซึ่งกำหนดว่าพฤติกรรมที่ถูกคือ "ตรวจพบว่า REQ-24 กับ REQ-27 ขัดกัน อ้างถึงทั้งสองข้อ แล้วหยุดถามผู้ใช้ ไม่เลือกข้างเอง" · การบังคับให้ผ่านเทสยอมรับที่ต้อง implement REQ-24 ถึง REQ-28 ครบ แปลว่าต้

## 2. ข้อกำหนดที่โจทย์อ้างถึง และการวัด

| ข้อกำหนด | เนื้อความ | โจทย์ที่อ้างถึง | มีเทสยอมรับกล่าวถึง |
|---|---|---|---|
| REQ-04 | ระยะเวลาการจองต้องเป็นจำนวนเท่าของ 15 นาที | S02-increment-validation | S02-increment-validation |
| REQ-05 | ห้ามจองซ้อนทับกับการจองที่ยังมีผลบนเครื่องเดียวกัน | S18-availability-rejected | S18-availability-rejected |
| REQ-10 | `STUDENT` จองได้ครั้งละไม่เกิน **8 ชั่วโมง** | S06-per-booking-quota | S06-per-booking-quota |
| REQ-11 | `PHD_STUDENT` จองได้ครั้งละไม่เกิน **24 ชั่วโมง** *(ต้องรันการฝึกโมเดลที่ใช้เวลานานและหยุด | S06-per-booking-quota | S06-per-booking-quota |
| REQ-12 | `LECTURER` จองได้ครั้งละไม่เกิน **4 ชั่วโมง** *(ใช้เพื่อสาธิตและทดสอบระยะสั้น หากต้องใช้ยา | S06-per-booking-quota | S06-per-booking-quota |
| REQ-13 | `LAB_ADMIN` จองได้ครั้งละไม่เกิน **12 ชั่วโมง** | S06-per-booking-quota | S06-per-booking-quota |
| REQ-14 | โควตารายสัปดาห์: `STUDENT` 24 ชม. / `PHD_STUDENT` 96 ชม. / `LECTURER` 16 ชม. / `LAB_ADMIN` | S07-weekly-quota | S07-weekly-quota |
| REQ-15 | สัปดาห์เริ่มนับวันจันทร์ เวลา 00:00 | S07-weekly-quota, S11-week-boundary | S07-weekly-quota, S11-week-boundary |
| REQ-16 | การจองที่ถูกยกเลิกไม่นับรวมในโควตารายสัปดาห์ | — | S07-weekly-quota |
| REQ-18 | ผู้อนุมัติต้องมีบทบาท `LAB_ADMIN` | — | S13-self-approval |
| REQ-19 | ผู้ขอจองอนุมัติคำขอของตัวเองไม่ได้ **แม้จะมีบทบาท `LAB_ADMIN`** | S13-self-approval | S13-self-approval |
| REQ-20 | อนุมัติได้เฉพาะคำขอที่มีสถานะ `REQUESTED` | — | S22-reject-reason-only |
| REQ-21 | การปฏิเสธต้องระบุเหตุผล | S22-reject-reason-only | S22-reject-reason-only |
| REQ-22 | คำขอที่ยังไม่ได้รับอนุมัติเมื่อถึงเวลา `startAt` ให้เปลี่ยนเป็น `REJECTED` อัตโนมัติ พร้อม | S12-approval-timeout | S12-approval-timeout |
| REQ-23 | การจองไม่เกิน 8 ชั่วโมง ไม่ต้องผ่านการอนุมัติ เริ่มใช้งานได้ทันที | — | S20-start-unapproved, S21-start-unapproved-explicit |
| REQ-24 | ผู้ใช้ยกเลิกการจองของตัวเองได้ทุกเมื่อก่อนถึงเวลาเริ่มใช้งาน | S05-cancel-basic, S10-cancel-conflict | S05-cancel-basic, S10-cancel-conflict |
| REQ-25 | `LAB_ADMIN` ยกเลิกการจองของผู้ใช้คนใดก็ได้ | S10-cancel-conflict | S05-cancel-basic, S10-cancel-conflict |
| REQ-26 | ยกเลิกการจองที่มีสถานะ `COMPLETED` หรือ `CANCELLED` อยู่แล้วไม่ได้ | S10-cancel-conflict | S05-cancel-basic, S10-cancel-conflict |
| REQ-27 | ห้ามยกเลิกการจองภายใน **2 ชั่วโมง** ก่อนเวลาเริ่มใช้งาน เพื่อให้ผู้อื่นมีโอกาสจองแทนได้ทัน | S10-cancel-conflict | S05-cancel-basic, S10-cancel-conflict |
| REQ-28 | การยกเลิกต้องบันทึกเหตุการณ์ `BookingCancelled` พร้อมผู้ที่สั่งยกเลิก | S05-cancel-basic, S10-cancel-conflict | S05-cancel-basic, S10-cancel-conflict |
| REQ-29 | เริ่มใช้งานได้เมื่อสถานะเป็น `APPROVED` หรือเป็นการจองที่ไม่ต้องอนุมัติ | S20-start-unapproved, S21-start-unapproved-explicit | S20-start-unapproved, S21-start-unapproved-explicit |
| REQ-30 | ไม่มีการเริ่มใช้ภายใน **30 นาที** หลัง `startAt` ให้บันทึก `NoShowRecorded` และเปลี่ยนสถาน | S04-noshow-status | S04-noshow-status |
| REQ-34 | อัตราค่าบริการ: A100 = 40 บาท/ชม. / V100 = 20 บาท/ชม. | S09-rate-change | S09-rate-change |
| REQ-35 | ระยะเวลาที่นำไปคิดค่าบริการ ให้**ปัดขึ้น**เป็นจำนวนเท่าของ 15 นาที | S08-rounding-change, S16-duration-refactor, S17-duration-refactor-billing | S16-duration-refactor, S17-duration-refactor-billing |
| REQ-38 | ใบแจ้งหนี้รายเดือนรวมทุกการจองสถานะ `COMPLETED` และ `NO_SHOW` ที่เกิดในเดือนนั้น | — | S14-corrupt-event-line, S15-corrupt-event-line-explicit |
| REQ-39 | ทุกการเปลี่ยนสถานะต้องบันทึกเป็นเหตุการณ์ พร้อมเวลาและผู้กระทำ | S01-history-endpoint, S19-actor-backfill | S12-approval-timeout, S19-actor-backfill |
| REQ-40 | เหตุการณ์ที่บันทึกแล้วห้ามแก้ไขหรือลบ ทุกการเปลี่ยนแปลงทำได้เฉพาะการเพิ่มเหตุการณ์ใหม่ต่อท | S14-corrupt-event-line, S15-corrupt-event-line-explicit, S19-actor-backfill | S14-corrupt-event-line, S15-corrupt-event-line-explicit, S19-actor-backfill |
| REQ-41 | ต้องเรียกดูประวัติทั้งหมดของการจองหนึ่งรายการได้ตามลำดับเวลา | S01-history-endpoint | S01-history-endpoint |
| REQ-52 | ข้อผิดพลาดตอบกลับในรูปแบบเดียวกันทุกกรณี | S03-error-format | S03-error-format |

## 3. ข้อกำหนดที่ไม่มีโจทย์ใดแตะเลย

มี **14 จาก 43 ข้อ** ที่ไม่มีโจทย์ใดอ้างถึงและไม่มีเทสยอมรับกล่าวถึง

ข้อเหล่านี้อยู่นอกขอบเขตของการทดลอง ไม่ใช่ช่องโหว่ของการวัด
แต่ต้องเขียนไว้ในเล่มว่า **การทดลองครอบคลุมข้อกำหนดเพียงบางส่วน** ไม่ใช่ทั้งระบบ

`REQ-01` · `REQ-02` · `REQ-03` · `REQ-06` · `REQ-07` · `REQ-08` · `REQ-17` · `REQ-31` · `REQ-32` · `REQ-33` · `REQ-36` · `REQ-37` · `REQ-50` · `REQ-51`

## 4. สิ่งที่แผนที่นี้ยังบอกไม่ได้

- การที่เทสยอมรับ **กล่าวถึง** ข้อกำหนดข้อหนึ่ง ไม่ได้แปลว่าวัดครบทุกแง่ของข้อนั้น
  ตารางนี้อ่านจากการอ้างอิงในชื่อเทสและคอมเมนต์ ซึ่งเป็นตัวแทนที่หยาบ
- ข้อกำหนดที่ถูกวัดโดยกฎอื่นที่ไม่ใช่เทสยอมรับ (เช่น `files_not_touch`, `text_matches`)
  ไม่ปรากฏในคอลัมน์สุดท้าย จึงต้องอ่านคู่กับไฟล์ scenario เอง
- ความถูกต้องของเทสยอมรับเองถูกตรวจแยกด้วยสามด่าน:
  ตกบน baseline · เขียวเมื่อปะเฉลยอ้างอิง · เฉลยผิดต้องตกและเฉลยคนละแบบต้องผ่าน

