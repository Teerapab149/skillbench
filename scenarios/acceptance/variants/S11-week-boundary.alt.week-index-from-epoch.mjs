/**
 * เฉลยถูกแต่เขียนคนละแบบ ของ S11-week-boundary — week-index-from-epoch
 *
 * เฉลยอ้างอิงหาต้นสัปดาห์ด้วย getUTCDay() แล้วหมุนให้จันทร์ = 0
 * ฉบับนี้ไม่ถามวันในสัปดาห์เลย แต่หารเวลาด้วยความยาวสัปดาห์จากหมุดที่เป็นวันจันทร์:
 * 5 ม.ค. 1970 เป็นวันจันทร์ ดังนั้น floor((t - หมุด) / 7 วัน) คือดัชนีสัปดาห์
 *
 * ทั้งสองวิธีให้ขอบเขตเดียวกันเป๊ะคือเที่ยงคืนวันจันทร์ UTC แต่คนละเลขคนละรูปแบบ
 * (อันหนึ่งได้ epoch ของต้นสัปดาห์ อีกอันได้ดัชนีสัปดาห์) ถ้าเทสตกกับไฟล์นี้
 * แปลว่ามันวัดวิธีคำนวณ ไม่ได้วัดว่าขอบเขตสัปดาห์อยู่ตรงไหน ซึ่งคือ REQ-15
 *
 * การกรองการจองที่ไม่นับก็เขียนคนละแบบ: ใช้รายการสถานะที่ "ยังนับ" แทนการไล่ปฏิเสธทีละสถานะ
 *
 * ต้อง **ผ่าน** เทสยอมรับ ถ้าตกแปลว่าเทสผูกกับ implementation
  *
 * แก้ 4 ต.ค. 2569 (Study 3): ปะทับสภาพเริ่มต้นของโจทย์ที่นับย้อนหลัง 7 วันอยู่แล้ว
 */
export const kind = 'alt';
export const patches = [
  {
    "file": "src/domain/booking.ts",
    "find": "export interface CreateBookingCommand {",
    "replace": "/** 5 ม.ค. 1970 เป็นวันจันทร์ — ใช้เป็นหมุดของการหารสัปดาห์ */\nconst MONDAY_EPOCH_MS = Date.UTC(1970, 0, 5);\nconst WEEK_MS = 7 * 24 * 60 * 60 * 1000;\n\n/**\n * ดัชนีสัปดาห์ของเวลาที่ระบุ — สัปดาห์เริ่มวันจันทร์ 00:00 UTC (REQ-15)\n *\n * เวลาสองจุดอยู่สัปดาห์เดียวกันก็ต่อเมื่อได้ดัชนีเท่ากัน\n * ขอบเขตจึงตกที่เที่ยงคืนวันจันทร์เสมอ ไม่ใช่ \"ย้อนหลัง 7 วันจากวันนี้\"\n * ซึ่งเป็นคนละความหมายและผิดตามข้อกำหนด\n */\nfunction weekIndex(iso: string): number {\n  return Math.floor((new Date(iso).getTime() - MONDAY_EPOCH_MS) / WEEK_MS);\n}\n\n/** สถานะที่ยังกินโควตารายสัปดาห์ — ที่ยกเลิกหรือถูกปฏิเสธไม่อยู่ในนี้ (REQ-16) */\nconst COUNTS_TOWARD_QUOTA: BookingStatus[] = ['REQUESTED', 'APPROVED', 'ACTIVE', 'COMPLETED'];\n\nexport interface CreateBookingCommand {"
  },
  {
    "file": "src/domain/booking.ts",
    "find": "  const weekCap = MAX_HOURS_PER_WEEK[cmd.userRole];\n  if (weekCap !== null && weekCap !== undefined) {\n    // REQ-14 — นับชั่วโมงที่จองไว้ในช่วง 7 วันก่อนเวลาเริ่มของการจองนี้\n    const from = new Date(cmd.startAt).getTime() - 7 * 86400000;\n    const to = new Date(cmd.startAt).getTime();\n    const used = existing\n      .filter((b) => b.userId === cmd.userId && b.status !== 'CANCELLED' && b.status !== 'REJECTED')\n      .filter((b) => { const t = new Date(b.startAt).getTime(); return t >= from && t <= to; })\n      .reduce((sum, b) => sum + bookedHours(b.startAt, b.endAt), 0);\n    if (used + bookedHours(cmd.startAt, cmd.endAt) > weekCap) {\n      throw new DomainError('WEEKLY_QUOTA_EXCEEDED', 'เกินโควตารายสัปดาห์', 422);\n    }\n  }\n\n  const clash = existing.find(",
    "replace": "  const weekCap = MAX_HOURS_PER_WEEK[cmd.userRole];\n  if (weekCap !== null && weekCap !== undefined) {\n    const wk = weekIndex(cmd.startAt);\n    let used = 0;\n    for (const b of existing) {\n      if (b.userId !== cmd.userId) continue;\n      if (!COUNTS_TOWARD_QUOTA.includes(b.status)) continue;\n      if (weekIndex(b.startAt) !== wk) continue;\n      used += bookedHours(b.startAt, b.endAt);\n    }\n    if (used + bookedHours(cmd.startAt, cmd.endAt) > weekCap) {\n      throw new DomainError('WEEKLY_QUOTA_EXCEEDED',\n        `เกินโควตารายสัปดาห์ของบทบาท ${cmd.userRole} (${weekCap} ชั่วโมง)`, 422);\n    }\n  }\n\n  const clash = existing.find("
  }
];
