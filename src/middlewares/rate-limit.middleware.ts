import { Context, Next } from 'hono'
import { Env } from '../config/env'
import { TooManyRequestsError } from '../lib/errors'

export const rateLimitMiddleware = async (c: Context<Env>, next: Next) => {
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  const key = `${ip}:${c.req.path}`

  const { success } = await c.env.RATE_LIMITER.limit({ key })

  if (!success) {
    throw new TooManyRequestsError('Terlalu banyak percobaan, coba lagi nanti')
  }

  await next()
}
