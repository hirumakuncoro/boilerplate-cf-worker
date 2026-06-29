import * as bcrypt from 'bcryptjs'
import { Context } from 'hono'
import { sign, verify } from 'hono/jwt'
import { Env, getEnv } from '../config/env'
import { getDb } from '../db/client'
import { refreshTokens } from '../db'
import { eq, lt } from 'drizzle-orm'

const ACCESS_TOKEN_EXP = 60 * 15            // 15 menit
const REFRESH_TOKEN_EXP = 60 * 60 * 24 * 7  // 7 hari

export const createAuthUtils = (c: Context<Env>) => {
  const env = getEnv(c)
  const JWT_SECRET = env.JWT_SECRET
  const db = getDb(c)

  return {
    hashPassword: async (password: string): Promise<string> => {
      return await bcrypt.hash(password, 10)
    },

    verifyPassword: async (
      password: string,
      hashedPassword: string
    ): Promise<boolean> => {
      return await bcrypt.compare(password, hashedPassword)
    },

    generateAccessToken: async (userId: number): Promise<string> => {
      const payload = {
        userId,
        type: 'access',
        exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_EXP,
      }
      return await sign(payload, JWT_SECRET)
    },

    generateRefreshToken: async (userId: number): Promise<string> => {
      const payload = {
        userId,
        type: 'refresh',
        exp: Math.floor(Date.now() / 1000) + REFRESH_TOKEN_EXP,
      }
      const token = await sign(payload, JWT_SECRET)
      const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXP * 1000)

      await db.insert(refreshTokens).values({ token, userId, expiresAt })

      return token
    },

    verifyAccessToken: async (token: string): Promise<{ userId: number } | null> => {
      try {
        const decoded = await verify(token, JWT_SECRET, 'HS256')
        if (decoded.type !== 'access') return null
        return { userId: Number(decoded.userId) }
      } catch {
        return null
      }
    },

    verifyRefreshToken: async (token: string): Promise<{ userId: number } | null> => {
      try {
        const row = await db
          .select()
          .from(refreshTokens)
          .where(eq(refreshTokens.token, token))
          .limit(1)

        if (!row[0] || row[0].expiresAt < new Date()) return null

        const decoded = await verify(token, JWT_SECRET, 'HS256')
        if (decoded.type !== 'refresh') return null

        return { userId: row[0].userId }
      } catch {
        return null
      }
    },

    revokeRefreshToken: async (token: string): Promise<void> => {
      await db.delete(refreshTokens).where(eq(refreshTokens.token, token))
    },

    purgeExpiredTokens: async (): Promise<void> => {
      await db.delete(refreshTokens).where(lt(refreshTokens.expiresAt, new Date()))
    },
  }
}
