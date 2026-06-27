import { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'

export const errorHandler = (err: Error, c: Context) => {
  if (err instanceof SyntaxError && err.message.includes('JSON')) {
    return c.json({
      message: 'Format JSON tidak valid.',
      data: null,
    }, 400)
  }

  if (err instanceof ZodError) {
    const firstMessageError = err.issues[0]?.message || 'Validasi gagal'
    return c.json({
      message: firstMessageError,
      data: null,
    }, 422)
  }

  if (err instanceof HTTPException) {
    return c.json({
      message: err.message,
      data: null
    }, err.status)
  }

  console.error(err)

  return c.json({
    message: 'Internal Server Error',
    data: null
  }, 500)
}
