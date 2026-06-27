import { Hono } from 'hono'
import { Env } from '../config/env'
import { authRouter } from '../modules/auth/auth.route'
import { uploadRouter } from '../modules/upload/upload.route'

export const routes = new Hono<Env>()

routes.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  })
})

routes.route('/auth', authRouter)
routes.route('/upload', uploadRouter)
