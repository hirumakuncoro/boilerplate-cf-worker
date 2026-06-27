import { Hono } from 'hono'
import { Env } from '../../config/env'
import { authService } from './auth.service'
import { ok, created, noContent } from '../../lib/response'
import { authMiddleware } from '../../middlewares/auth.middleware'
import { loginSchema, registerSchema, tokenSchema } from './auth.validator'

export const authRouter = new Hono<Env>()

authRouter.post('/register', async (c) => {
  const body = await c.req.json()
  const service = authService(c)
  const input = registerSchema.parse(body)
  const data = await service.register(input)
  return created(c, data, 'Registrasi berhasil')
})

authRouter.post('/login', async (c) => {
  const body = await c.req.json()
  const service = authService(c)
  const input = loginSchema.parse(body)
  const data = await service.login(input)
  return ok(c, data, 'Login berhasil')
})

authRouter.post('/logout', async (c) => {
  const body = await c.req.json()
  const input = tokenSchema.parse(body)
  await authService(c).logout(input.refreshToken)
  return noContent(c)
})

authRouter.post('/refresh', async (c) => {
  const body = await c.req.json()
  const input = tokenSchema.parse(body)
  const data = await authService(c).refresh(input.refreshToken)
  return ok(c, data, 'Token diperbarui')
})

authRouter.get('/me', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const data = await authService(c).me(userId)
  return ok(c, data)
})
