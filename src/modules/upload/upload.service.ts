import { Context } from 'hono'
import { Env } from '../../config/env'
import { getStorage } from '../../storage'
import { BadRequestError } from '../../lib/errors'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]

export const uploadService = (c: Context<Env>) => {
  return {
    uploadFile: async (file: File, userId: number) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        throw new BadRequestError(
          `Tipe file tidak diizinkan. Gunakan: ${ALLOWED_TYPES.join(', ')}`
        )
      }

      if (file.size > MAX_FILE_SIZE) {
        throw new BadRequestError('Ukuran file maksimal 5MB')
      }

      const ext = file.name.split('.').pop()
      const key = `uploads/${crypto.randomUUID()}.${ext}`

      const storage = getStorage(c)
      await storage.put(key, await file.arrayBuffer(), {
        contentType: file.type,
        metadata: {
          originalName: file.name,
          uploadedBy: String(userId),
        },
      })

      return {
        key,
        url: storage.getPublicUrl(key),
        name: file.name,
        size: file.size,
        contentType: file.type,
      }
    },
  }
}
