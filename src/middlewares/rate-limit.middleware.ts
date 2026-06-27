import { Context, Next } from 'hono'
import { Env } from '../config/env'
import { TooManyRequestsError } from '../lib/errors'

const MAX_ATTEMPTS = 120  // 60 request
const WINDOW_SECONDS = 60 // per 1 menit

export const rateLimitMiddleware = async (c: Context<Env>, next: Next) => {
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  const key = `rate:${ip}:${c.req.path}`

  const current = await c.env.STORE.get(key)
  const attempts = current ? parseInt(current) : 0

  if (attempts >= MAX_ATTEMPTS) {
    throw new TooManyRequestsError('Terlalu banyak percobaan, coba lagi nanti')
  }

  await c.env.STORE.put(key, String(attempts + 1), {
    expirationTtl: WINDOW_SECONDS,
  })

  await next()
}
