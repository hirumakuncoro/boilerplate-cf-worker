import * as bcrypt from 'bcryptjs'
import { Context } from 'hono'
import { sign, verify } from 'hono/jwt'
import { Env, getEnv } from '../config/env'

const ACCESS_TOKEN_EXP = 60 * 15           // 15 menit
const REFRESH_TOKEN_EXP = 60 * 60 * 24 * 7 // 7 hari

export const createAuthUtils = (c: Context<Env>) => {
  const env = getEnv(c)
  const JWT_SECRET = env.JWT_SECRET

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

      await env.STORE.put(`refresh:${token}`, String(userId), {
        expirationTtl: REFRESH_TOKEN_EXP,
      })

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
        const userId = await env.STORE.get(`refresh:${token}`)
        if (!userId) return null

        const decoded = await verify(token, JWT_SECRET, 'HS256')
        if (decoded.type !== 'refresh') return null

        return { userId: Number(userId) }
      } catch {
        return null
      }
    },

    revokeRefreshToken: async (token: string): Promise<void> => {
      await env.STORE.delete(`refresh:${token}`)
    },
  }
}
