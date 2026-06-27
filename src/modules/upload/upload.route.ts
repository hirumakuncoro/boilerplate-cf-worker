import { Hono } from 'hono'
import { Env } from '../../config/env'
import { authMiddleware } from '../../middlewares/auth.middleware'
import { uploadService } from './upload.service'
import { ok } from '../../lib/response'
import { BadRequestError } from '../../lib/errors'

export const uploadRouter = new Hono<Env>()

uploadRouter.post('/', authMiddleware, async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null

  if (!file) throw new BadRequestError('File harus diupload')

  const userId = c.get('userId')
  const data = await uploadService(c).uploadFile(file, userId)

  return ok(c, data, 'File berhasil diupload')
})
