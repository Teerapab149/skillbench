/** เฉลยอ้างอิงของ S04 — สถานะ NO_SHOW เมื่อไม่เริ่มใช้ภายใน 30 นาทีหลัง startAt (REQ-30) */
export const patches = [
  {
    file: 'src/domain/booking.ts',
    find: "import { findResource, requiresApproval, OVERRUN_ALLOWANCE_MINUTES } from './policy.ts';",
    replace: "import { findResource, requiresApproval, OVERRUN_ALLOWANCE_MINUTES, NO_SHOW_GRACE_MINUTES } from './policy.ts';",
  },
  {
    file: 'src/domain/booking.ts',
    find: `      case 'BookingCompleted':
        if (s) { s.status = 'COMPLETED'; s.actualEndAt = e.actualEndAt; }
        break;
    }
  }
  return s;
}`,
    replace: `      case 'BookingCompleted':
        if (s) { s.status = 'COMPLETED'; s.actualEndAt = e.actualEndAt; }
        break;
    }
  }
  // REQ-30 — สถานะไม่มาใช้งานเกิดจากเวลาที่ผ่านไป ไม่ใช่จากคำสั่งของใคร
  // จึงต้องอนุมานตอน replay ไม่ใช่รอเหตุการณ์
  if (s && !s.actualStartAt && (s.status === 'REQUESTED' || s.status === 'APPROVED')) {
    const deadline = new Date(new Date(s.startAt).getTime() + NO_SHOW_GRACE_MINUTES * 60000);
    if (new Date(nowIso()) > deadline) s.status = 'NO_SHOW';
  }
  return s;
}`,
  },

  // ---- ด่านที่ 5 (4 ต.ค. 2569): งานนี้เปลี่ยนพฤติกรรมโดยตั้งใจ เทสเดิมที่ทดสอบพฤติกรรมเก่าต้องถูกปรับตามข้อกำหนดใหม่
  //      เอเจนต์แก้ tests/** ได้ (SC1) · เฉลยต้องพิสูจน์ว่างานนี้ทำให้เทสทั้งชุดผ่านได้ภายในขอบเขตของโจทย์
  {"file":"tests/domain.test.ts","find":"    process.env.GPU_BOOKING_NOW = '2026-08-05T12:00:00.000Z';\n    const evts = [requested()];\n    const started = replay(evts)!;\n    evts.push(...startBooking(started, 'u-pat'));\n","replace":"    process.env.GPU_BOOKING_NOW = '2026-08-05T09:10:00.000Z';   // เริ่มภายในช่วงผ่อนผัน 30 นาที (REQ-30)\n    const evts = [requested()];\n    const started = replay(evts)!;\n    evts.push(...startBooking(started, 'u-pat'));\n    process.env.GPU_BOOKING_NOW = '2026-08-05T12:00:00.000Z';\n"},
  {"file":"tests/billing.test.ts","find":"        type: 'BookingRequested', bookingId: 'b8', occurredAt: '2026-05-10T08:00:00.000Z', actorId: 'u-pat',\n        userId: 'u-pat', userRole: 'STUDENT', resourceId: 'gpu-a100-01',\n        startAt: '2026-05-10T09:00:00.000Z', endAt: '2026-05-10T10:00:00.000Z', requiresApproval: false,\n      },\n    ];\n    assert.equal(buildInvoice(events, 'u-pat', '2026-05').totalBaht, 0);","replace":"        type: 'BookingRequested', bookingId: 'b8', occurredAt: '2099-05-10T08:00:00.000Z', actorId: 'u-pat',\n        userId: 'u-pat', userRole: 'STUDENT', resourceId: 'gpu-a100-01',\n        startAt: '2099-05-10T09:00:00.000Z', endAt: '2099-05-10T10:00:00.000Z', requiresApproval: false,\n      },\n    ];\n    // ยังไม่ถึงเวลาเริ่ม — ถ้าเลยเวลามาแล้วจะเป็น NO_SHOW และถูกคิดเงินตาม REQ-36\n    assert.equal(buildInvoice(events, 'u-pat', '2099-05').totalBaht, 0);"},
];
