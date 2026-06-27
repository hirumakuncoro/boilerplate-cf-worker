import { Hono } from 'hono'
import { routes } from './routes'
import { errorHandler } from './middlewares/error.middleware'
import { Env } from './config/env'
import { cors } from 'hono/cors'
// import { logger } from 'hono/logger'
import { rateLimitMiddleware } from './middlewares/rate-limit.middleware'

const app = new Hono<Env>()

// app.use('*', logger())

app.use('*', cors({
  origin: ['https://myapp.com', 'http://localhost:5173'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

app.use('*', rateLimitMiddleware)

app.onError(errorHandler)
app.notFound((c) => {
  return c.json({
    message: `Route ${c.req.method} ${c.req.path} tidak ditemukan`,
    data: null
  }, 404)
})

app.route('/', routes)

export default app
