import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { ZodError, type ZodType } from 'zod'

export class AppError extends Error {
  constructor(public status: number, message: string, public code = 'error') {
    super(message)
  }
}

export const log = (level: 'info' | 'warn' | 'error', msg: string, extra: Record<string, unknown> = {}) =>
  console[level](JSON.stringify({ level, msg, time: new Date().toISOString(), ...extra }))

// ponytail: in-memory buckets per process; move to Postgres/Redis when running more than one instance.
const buckets = new Map<string, { count: number; reset: number }>()
export function rateLimit(req: NextRequest, name: string, limit: number, windowMs: number) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
  const key = `${name}:${ip}`
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || b.reset < now) return void buckets.set(key, { count: 1, reset: now + windowMs })
  if (++b.count > limit) throw new AppError(429, 'Too many requests — please wait a moment and try again.', 'rate_limited')
}

/** CSRF: state-changing requests must come from our own origin. */
function assertSameOrigin(req: NextRequest) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return
  const origin = req.headers.get('origin')
  const site = req.headers.get('sec-fetch-site')
  if (origin ? new URL(origin).host === req.headers.get('host') : site === 'same-origin' || site === null) return
  throw new AppError(403, 'Cross-site request refused.', 'csrf')
}

export async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  const json = await req.json().catch(() => {
    throw new AppError(400, 'Request body must be JSON.', 'bad_json')
  })
  return schema.parse(json)
}

type Ctx<P> = { params: Promise<P> }
export function route<P = Record<string, string>>(fn: (req: NextRequest, ctx: Ctx<P>) => Promise<unknown>) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      assertSameOrigin(req)
      const result = await fn(req, ctx)
      return result instanceof Response ? result : NextResponse.json(result ?? { ok: true })
    } catch (err) {
      if (err instanceof ZodError)
        return NextResponse.json({ error: 'Some fields need attention.', code: 'invalid', issues: err.issues }, { status: 400 })
      if (err instanceof AppError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status })
      log('error', 'unhandled route error', { path: req.nextUrl.pathname, error: String(err) })
      return NextResponse.json({ error: 'Something went wrong on our side.', code: 'internal' }, { status: 500 })
    }
  }
}
