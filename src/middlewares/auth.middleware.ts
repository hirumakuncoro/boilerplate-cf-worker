import { Context, Next } from 'hono'
import { Env, getEnv } from '../config/env'
import { createAuthUtils } from '../lib/auth'
import { UnauthorizedError } from '../lib/errors'

export const authMiddleware = async (c: Context<Env>, next: Next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Authorization header diperlukan')
  }

  const token = authHeader.split(' ')[1]
  const { JWT_SECRET } = getEnv(c)
  const auth = createAuthUtils(JWT_SECRET)
  const decoded = await auth.verifyAccessToken(token)
  if (!decoded) throw new UnauthorizedError('Access token tidak valid atau expired')

  c.set('userId', decoded.userId)

  await next()
}
