import { cookies } from 'next/headers';

const SESSION_COOKIE = 'sid';

// TODO: ย้ายไปใช้ signed cookie
// TODO: เพิ่ม session expiry
// TODO: log failed attempts
export async function getSession() {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (!sid) return null;
  return { id: sid, role: 'MEMBER' as const };
}

export async function requireSession() {
  const s = await getSession();
  if (!s) throw new Error('unauthenticated');
  return s;
}
