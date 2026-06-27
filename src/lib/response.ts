import { Context } from 'hono'

export const ok = <T>(c: Context, data: T, message = 'Success') => {
  return c.json({
    message,
    data,
  })
}

export const created = <T>(c: Context, data: T, message = 'Created') => {
  return c.json({
    message,
    data,
  }, 201)
}

export const noContent = (c: Context) => {
  return c.body(null, 204)
}