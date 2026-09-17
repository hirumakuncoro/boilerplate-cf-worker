import bcrypt from "bcryptjs";
import { sign, verify } from "hono/jwt";

const ACCESS_TOKEN_EXP = 60 * 15            // 15 menit
const REFRESH_TOKEN_EXP = 60 * 60 * 24 * 7  // 7 hari

export const createAuthUtils = (secret: string) => {

  const verifyToken = async (
    token: string,
    type: 'access' | 'refresh'
  ): Promise<{ userId: number } | null> => {
    try {
      const decoded = await verify(token, secret, 'HS256')
      if (decoded.type !== type) return null
      return { userId: Number(decoded.userId) }
    } catch {
      return null
    }
  }

  return {
    hashPassword: (password: string): Promise<string> =>
      bcrypt.hash(password, 10),

    verifyPassword: (password: string, hash: string): Promise<boolean> =>
      bcrypt.compare(password, hash),

    generateAccessToken: (userId: number, nowMs: number = Date.now()): Promise<string> =>
      sign({ userId, type: 'access', exp: Math.floor(nowMs / 1000) + ACCESS_TOKEN_EXP }, secret),

    generateRefreshToken: (userId: number, nowMs: number = Date.now()): Promise<string> =>
      sign({ userId, type: 'refresh', exp: Math.floor(nowMs / 1000) + REFRESH_TOKEN_EXP }, secret),

    refreshTokenExpiresAt: (nowMs: number = Date.now()): Date =>
      new Date(nowMs + REFRESH_TOKEN_EXP * 1000),

    verifyAccessToken: (token: string) => verifyToken(token, 'access'),
    verifyRefreshToken: (token: string) => verifyToken(token, 'refresh'),
  }
}
