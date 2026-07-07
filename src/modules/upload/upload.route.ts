import { Hono } from 'hono'
import { Env } from '../../config/env'
import { authMiddleware } from '../../middlewares/auth.middleware'
import { uploadService } from './upload.service'
import { ok } from '../../lib/response'
import { BadRequestError } from '../../lib/errors'

export const uploadRouter = new Hono<Env>()

uploadRouter.use(authMiddleware)

uploadRouter.post('/presign', async (c) => {
  const body = await c.req.json<{ filename: string; contentType: string }>()

  if (!body.filename || !body.contentType) {
    throw new BadRequestError('filename dan contentType wajib diisi')
  }

  const userId = c.get('userId')
  const data = await uploadService(c).getUploadUrl(body.filename, body.contentType, userId)

  return ok(c, data, 'Presigned URL berhasil dibuat')
})

uploadRouter.post('/save', async (c) => {
  const body = await c.req.json<{ title: string; fileName: string; fileKey: string }>()

  if (!body.title || !body.fileName || !body.fileKey) {
    throw new BadRequestError('title, fileName, dan fileKey wajib diisi')
  }

  const userId = c.get('userId')
  const data = await uploadService(c).saveFileMetadata(body.title, body.fileName, body.fileKey, userId)

  return ok(c, data, 'Metadata file berhasil disimpan')
})

uploadRouter.get('/files', async (c) => {
  const userId = c.get('userId')
  const data = await uploadService(c).getUserFiles(userId)
  return ok(c, data, 'Daftar file berhasil dimuat')
})

uploadRouter.get('/signed-url', async (c) => {
  const key = c.req.query('key')

  if (!key) throw new BadRequestError('Query param "key" wajib diisi')

  const userId = c.get('userId')
  const data = await uploadService(c).getFileUrl(key, userId)
  return ok(c, data, 'Signed URL berhasil dibuat')
})

uploadRouter.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))

  if (isNaN(id)) throw new BadRequestError('ID file tidak valid')

  const userId = c.get('userId')
  const data = await uploadService(c).deleteFile(id, userId)

  return ok(c, data, 'File berhasil dihapus')
})
