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
];
