import { Context, Hono } from 'hono'
import { Env, getEnv } from '../../config/env'
import { authService } from './auth.service'
import { ok, created, noContent } from '../../lib/response'
import { authMiddleware } from '../../middlewares/auth.middleware'
import { loginSchema, registerSchema, tokenSchema } from './auth.validator'
import { getDb } from '../../db/client'
import { authRepository } from './auth.repository'

export const authRouter = new Hono<Env>()

const createAuthService = (c: Context<Env>) => {
  const { JWT_SECRET } = getEnv(c)
  return authService(authRepository(getDb(c)), JWT_SECRET)
}

authRouter.post('/register', async (c) => {
  const body = await c.req.json()
  const service = createAuthService(c)
  const input = registerSchema.parse(body)
  const data = await service.register(input)
  return created(c, data, 'Registrasi berhasil')
})

authRouter.post('/login', async (c) => {
  const body = await c.req.json()
  const service = createAuthService(c)
  const input = loginSchema.parse(body)
  const data = await service.login(input)
  return ok(c, data, 'Login berhasil')
})

authRouter.post('/logout', async (c) => {
  const body = await c.req.json()
  const input = tokenSchema.parse(body)
  const service = createAuthService(c)
  await service.logout(input.refreshToken)
  return noContent(c)
})

authRouter.post('/refresh', async (c) => {
  const body = await c.req.json()
  const input = tokenSchema.parse(body)
  const service = createAuthService(c)
  const data = await service.refresh(input.refreshToken)
  return ok(c, data, 'Token diperbarui')
})

authRouter.get('/me', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const service = createAuthService(c)
  const data = await service.me(userId)
  return ok(c, data)
})
