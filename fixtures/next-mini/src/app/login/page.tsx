'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

// TODO: เพิ่ม rate limiting
// TODO: ย้าย validation ไป zod
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    setLoading(false);
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto mt-24 flex w-80 flex-col gap-3">
      <h1 className="text-xl font-semibold">เข้าสู่ระบบ</h1>
      <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="อีเมล" />
      <Input value={password} type="password" onChange={(e) => setPassword(e.target.value)} placeholder="รหัสผ่าน" />
      <Button type="submit" variant="danger" disabled={loading}>
        {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
      </Button>
    </form>
  );
}
