/**
 * เฉลยถูกแต่เขียนคนละแบบ ของ S05-cancel-basic — cancel-in-route
 *
 * ต่างจากเฉลยอ้างอิงสามอย่าง และทั้งสามอย่างคือสิ่งที่เทสไม่ควรผูกไว้:
 *   1. ไม่มีฟังก์ชัน cancelBooking() ในชั้นโดเมน — จัดการที่ route ทั้งหมด
 *   2. replay ไม่ได้เพิ่ม case ของตัวเอง แต่ใช้ตารางสถานะกับ default case
 *   3. เหตุการณ์บันทึกผู้สั่งยกเลิกด้วย actorId อย่างเดียว ไม่มี cancelledBy
 *
 * ข้อ 3 คือจุดที่เทสประกาศความยืดหยุ่นไว้เองว่า `ev.cancelledBy ?? ev.actorId`
 * ไฟล์นี้จึงเป็นตัวพิสูจน์ว่าคำประกาศนั้นเป็นจริง ไม่ใช่แค่คอมเมนต์
 *
 * ขอบเขตเท่าเฉลยอ้างอิงทุกประการ: ทำเฉพาะ REQ-24 และ REQ-28
 * ไม่แตะ REQ-25/26/27 ตามที่โจทย์สั่งว่าเอาไว้รอบหน้า
 *
 * ต้อง **ผ่าน** เทสยอมรับ ถ้าตกแปลว่าเทสผูกกับ implementation
 */
export const kind = 'alt';
export const patches = [
  {
    file: 'src/domain/booking.ts',
    find: `export function replay(events: DomainEvent[]): BookingState | null {`,
    replace: `/** เหตุการณ์ที่เปลี่ยนสถานะตรง ๆ — ไม่ต้องมี case ของตัวเองใน replay */
const STATUS_BY_EVENT: Record<string, BookingStatus> = {
  BookingCancelled: 'CANCELLED',
};

export function replay(events: DomainEvent[]): BookingState | null {`,
  },
  {
    file: 'src/domain/booking.ts',
    find: `      case 'BookingCompleted':
        if (s) { s.status = 'COMPLETED'; s.actualEndAt = e.actualEndAt; }
        break;
    }`,
    replace: `      case 'BookingCompleted':
        if (s) { s.status = 'COMPLETED'; s.actualEndAt = e.actualEndAt; }
        break;
      default: {
        const mapped = STATUS_BY_EVENT[e.type];
        if (s && mapped) { s.status = mapped; }
        break;
      }
    }`,
  },
  {
    file: 'src/api/routes.ts',
    find: `router.add('POST', '/bookings/:bookingId/approve', (ctx) => {`,
    replace: `/** ยกเลิกการจอง — REQ-24, REQ-28 */
router.add('POST', '/bookings/:bookingId/cancel', (ctx) => {
  const me = actor(ctx);
  const { state } = requireBooking(ctx.params.bookingId);
  if (new Date(nowIso()) >= new Date(state.startAt)) {
    return {
      status: 409,
      payload: { error: { code: 'INVALID_STATE', message: 'ยกเลิกได้เฉพาะก่อนถึงเวลาเริ่มใช้งาน' } },
    };
  }
  appendEvents([{
    type: 'BookingCancelled',
    bookingId: state.id,
    occurredAt: nowIso(),
    actorId: me.id,
  } as never]);
  return requireBooking(ctx.params.bookingId).state;
});

router.add('POST', '/bookings/:bookingId/approve', (ctx) => {`,
  },
];
