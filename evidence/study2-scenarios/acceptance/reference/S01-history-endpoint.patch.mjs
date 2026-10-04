/** เฉลยอ้างอิงของ S01 — เพิ่ม GET /bookings/{bookingId}/history ตาม REQ-41 */
export const patches = [
  {
    file: 'src/api/routes.ts',
    find: "import { loadEvents, appendEvents } from '../store/eventStore.ts';",
    replace: "import { loadEvents, appendEvents, loadEventsFor } from '../store/eventStore.ts';",
  },
  {
    file: 'src/api/routes.ts',
    find: `router.add('GET', '/bookings/:bookingId', (ctx) => {
  return requireBooking(ctx.params.bookingId).state;
});`,
    replace: `router.add('GET', '/bookings/:bookingId', (ctx) => {
  return requireBooking(ctx.params.bookingId).state;
});

router.add('GET', '/bookings/:bookingId/history', (ctx) => {
  requireBooking(ctx.params.bookingId);
  return [...loadEventsFor(ctx.params.bookingId)]
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
});`,
  },
];
