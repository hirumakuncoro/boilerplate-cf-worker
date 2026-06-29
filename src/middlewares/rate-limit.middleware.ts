import { Context, Next } from 'hono'
import { Env } from '../config/env'
import { TooManyRequestsError } from '../lib/errors'
import { getDb } from '../db/client'
import { rateLimits } from '../db'
import { eq, lt } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

const MAX_ATTEMPTS = 120 // request
const WINDOW_SECONDS = 60 // per 1 menit

export const rateLimitMiddleware = async (c: Context<Env>, next: Next) => {
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  const key = `rate:${ip}:${c.req.path}`
  const now = new Date()

  const db = getDb(c)

  const row = await db
    .select()
    .from(rateLimits)
    .where(eq(rateLimits.key, key))
    .limit(1)

  const existing = row[0]

  if (!existing || existing.resetAt < now) {
    c.executionCtx.waitUntil(
      db
        .insert(rateLimits)
        .values({
          key,
          attempts: 1,
          resetAt: new Date(now.getTime() + WINDOW_SECONDS * 1000),
        })
        .onConflictDoUpdate({
          target: rateLimits.key,
          set: {
            attempts: 1,
            resetAt: new Date(now.getTime() + WINDOW_SECONDS * 1000),
          },
        })
    )
    await next()
    return
  }

  if (existing.attempts >= MAX_ATTEMPTS) {
    throw new TooManyRequestsError('Terlalu banyak percobaan, coba lagi nanti')
  }

  // Increment di background, tidak blocking response
  c.executionCtx.waitUntil(
    db
      .update(rateLimits)
      .set({ attempts: sql`${rateLimits.attempts} + 1` })
      .where(eq(rateLimits.key, key))
  )

  await next()
}
