import { Context, Hono } from 'hono'
import { Env, getEnv } from '../../config/env'
import { authService } from './auth.service'
import { ok, created, noContent } from '../../lib/response'
import { authMiddleware } from '../../middlewares/auth.middleware'
import { loginSchema, registerSchema, tokenSchema } from './auth.validator'
import { getDb } from '../../db/client'
import { authRepository } from './auth.repository'

type AuthService = ReturnType<typeof authService>

const defaultServiceFactory = (c: Context<Env>) => {
  const { JWT_SECRET } = getEnv(c)
  return authService(authRepository(getDb(c)), JWT_SECRET)
}

export const authRouter = (
  serviceFactory: (c: Context<Env>) => AuthService = defaultServiceFactory
) => {
  const router = new Hono<Env>()

  router.post('/register', async (c) => {
    const body = await c.req.json()
    const service = serviceFactory(c)
    const input = registerSchema.parse(body)
    const data = await service.register(input)
    return created(c, data, 'Registrasi berhasil')
  })

  router.post('/login', async (c) => {
    const body = await c.req.json()
    const service = serviceFactory(c)
    const input = loginSchema.parse(body)
    const data = await service.login(input)
    return ok(c, data, 'Login berhasil')
  })

  router.post('/logout', async (c) => {
    const body = await c.req.json()
    const input = tokenSchema.parse(body)
    const service = serviceFactory(c)
    await service.logout(input.refreshToken)
    return noContent(c)
  })

  router.post('/refresh', async (c) => {
    const body = await c.req.json()
    const input = tokenSchema.parse(body)
    const service = serviceFactory(c)
    const data = await service.refresh(input.refreshToken)
    return ok(c, data, 'Token diperbarui')
  })

  router.get('/me', authMiddleware, async (c) => {
    const userId = c.get('userId')
    const service = serviceFactory(c)
    const data = await service.me(userId)
    return ok(c, data)
  })

  return router
}
