/**
 * Router ขนาดเล็กบน node:http — ไม่ใช้ framework ภายนอกเพื่อให้ระบบไม่มี dependency
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

export interface Ctx {
  method: string;
  pathname: string;
  params: Record<string, string>;
  query: URLSearchParams;
  body: any;
  userId: string;
  userRole: string;
}

type Handler = (ctx: Ctx) => Promise<unknown> | unknown;

interface Route {
  method: string;
  pattern: string;
  segments: string[];
  handler: Handler;
}

export class Router {
  private routes: Route[] = [];

  add(method: string, pattern: string, handler: Handler): void {
    this.routes.push({ method, pattern, segments: pattern.split('/').filter(Boolean), handler });
  }

  private match(method: string, pathname: string): { route: Route; params: Record<string, string> } | null {
    const parts = pathname.split('/').filter(Boolean);
    for (const route of this.routes) {
      if (route.method !== method || route.segments.length !== parts.length) continue;
      const params: Record<string, string> = {};
      let ok = true;
      for (let i = 0; i < parts.length; i++) {
        const seg = route.segments[i];
        if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(parts[i]);
        else if (seg !== parts[i]) { ok = false; break; }
      }
      if (ok) return { route, params };
    }
    return null;
  }

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const found = this.match(req.method ?? 'GET', url.pathname);

    if (!found) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'ไม่พบเส้นทางที่เรียก' } }));
      return;
    }

    let body: any = undefined;
    if (req.method === 'POST' || req.method === 'PUT') {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const raw = Buffer.concat(chunks).toString('utf8');
      if (raw) { try { body = JSON.parse(raw); } catch { body = undefined; } }
    }

    const ctx: Ctx = {
      method: req.method ?? 'GET',
      pathname: url.pathname,
      params: found.params,
      query: url.searchParams,
      body,
      userId: String(req.headers['x-user-id'] ?? ''),
      userRole: String(req.headers['x-user-role'] ?? ''),
    };

    const { status, payload } = await runHandler(found.route.handler, ctx);
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(payload));
  }
}

/** แยกออกมาเพื่อให้เทสเรียกได้โดยไม่ต้องเปิด server จริง */
export async function runHandler(handler: Handler, ctx: Ctx): Promise<{ status: number; payload: unknown }> {
  try {
    const result = await handler(ctx);
    if (result && typeof result === 'object' && 'status' in (result as any) && 'payload' in (result as any)) {
      return result as { status: number; payload: unknown };
    }
    return { status: ctx.method === 'POST' ? 200 : 200, payload: result };
  } catch (e: any) {
    if (e && typeof e.httpStatus === 'number') {
      return { status: e.httpStatus, payload: { error: { code: e.code, message: e.message } } };
    }
    return { status: 500, payload: { error: { code: 'INTERNAL', message: String(e?.message ?? e) } } };
  }
}
