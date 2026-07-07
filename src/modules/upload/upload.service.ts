import { Context } from 'hono'
import { Env } from '../../config/env'
import { getStorage } from '../../storage'
import { BadRequestError, ForbiddenError, NotFoundError } from '../../lib/errors'
import { uploadRepository } from './upload.repository'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

const ALLOWED_TYPES = [
  'image/jpg',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]

export const uploadService = (c: Context<Env>) => {
  const storage = getStorage(c)
  const isPublic = c.env.STORAGE_PUBLIC_URL !== undefined && c.env.STORAGE_PUBLIC_URL !== ''

  return {
    /**
     * Upload langsung melalui Worker (multipart formdata).
     */
    uploadFile: async (file: File, title: string, userId: number) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        throw new BadRequestError(
          `Tipe file tidak diizinkan. Gunakan: ${ALLOWED_TYPES.join(', ')}`
        )
      }

      if (file.size > MAX_FILE_SIZE) {
        throw new BadRequestError('Ukuran file maksimal 5MB')
      }

      const ext = file.name.split('.').pop()
      const key = `uploads/${userId}/${crypto.randomUUID()}.${ext}`

      await storage.put(key, await file.arrayBuffer(), {
        contentType: file.type,
        metadata: {
          originalName: file.name,
          uploadedBy: String(userId),
        },
      })

      const url = isPublic
        ? storage.getPublicUrl(key)
        : await storage.getSignedUrl(key)

      const repo = uploadRepository(c)
      const dbRecord = await repo.create({
        title,
        fileName: file.name,
        fileKey: key,
        userId,
      })

      return {
        key,
        url,
        name: file.name,
        size: file.size,
        contentType: file.type,
        dbRecord,
      }
    },

    /**
     * Simpan metadata file ke database (untuk alur presigned URL upload).
     */
    saveFileMetadata: async (title: string, fileName: string, fileKey: string, userId: number) => {
      if (!fileKey.startsWith(`uploads/${userId}/`)) {
        throw new ForbiddenError('Akses ditolak: fileKey tidak valid untuk user Anda')
      }

      const repo = uploadRepository(c)
      return await repo.create({
        title,
        fileName,
        fileKey,
        userId,
      })
    },

    /**
     * Dapatkan semua metadata file yang diunggah oleh user tertentu.
     */
    getUserFiles: async (userId: number) => {
      const repo = uploadRepository(c)
      return await repo.findByUserId(userId)
    },

    /**
     * Generate presigned PUT URL untuk upload langsung dari client ke storage.
     * Worker hanya membuat URL — body file tidak pernah melewati Worker.
     *
     * Alur:
     *   1. Client → POST /upload/presign  { filename, contentType }
     *   2. Worker → kembalikan { uploadUrl, key, expiresIn, maxSize }
     *   3. Client → PUT uploadUrl  (dengan body file langsung ke storage)
     *   4. Client → simpan `key` dan `title` ke DB via POST /upload/save
     */
    getUploadUrl: async (filename: string, contentType: string, userId: number) => {
      if (!ALLOWED_TYPES.includes(contentType)) {
        throw new BadRequestError(
          `Tipe file tidak diizinkan. Gunakan: ${ALLOWED_TYPES.join(', ')}`
        )
      }

      const ext = filename.split('.').pop()
      const key = `uploads/${userId}/${crypto.randomUUID()}.${ext}`

      const result = await storage.getUploadUrl(key, contentType, 300, MAX_FILE_SIZE)

      return result
    },

    /**
     * Generate signed GET URL untuk mengakses file private.
     * Gunakan ini ketika perlu menampilkan/mengunduh file dari bucket private.
     */
    getFileUrl: async (key: string, userId: number) => {
      if (!key.startsWith(`uploads/${userId}/`)) {
        throw new ForbiddenError('Akses ditolak: File bukan milik Anda')
      }
      if (isPublic) {
        return { url: storage.getPublicUrl(key) }
      }
      const url = await storage.getSignedUrl(key, 3600)
      return { url }
    },

    /**
     * Hapus file dari storage dan metadata dari database.
     * Ownership divalidasi — user hanya bisa hapus file miliknya sendiri.
     */
    deleteFile: async (id: number, userId: number) => {
      const repo = uploadRepository(c)

      const file = await repo.findById(id)
      if (!file) {
        throw new NotFoundError('File tidak ditemukan')
      }

      if (file.userId !== userId) {
        throw new ForbiddenError('Akses ditolak: File bukan milik Anda')
      }

      await storage.delete(file.fileKey)

      await repo.deleteById(id)

      return { id, fileKey: file.fileKey }
    },
  }
}
