import { Context } from 'hono'
import { Env } from '../../config/env'
import { getDb } from '../../db/client'
import { files, FileRecord, NewFileRecord } from '../../db'
import { eq } from 'drizzle-orm'
import { ConflictError } from '../../lib/errors'

export const uploadRepository = (c: Context<Env>) => {
  const db = getDb(c)

  return {
    create: async (data: { title: string; fileName: string; fileKey: string; userId: number }): Promise<FileRecord> => {
      try {
        const result = await db
          .insert(files)
          .values({
            title: data.title,
            fileName: data.fileName,
            fileKey: data.fileKey,
            userId: data.userId,
          } satisfies NewFileRecord)
          .returning()

        return result[0]
      } catch (err: any) {
        const pgCode: string | undefined = err?.cause?.code
        const causeMessage: string = err?.cause?.message ?? err?.message ?? ''

        if (
          pgCode === '23505' ||
          causeMessage.includes('UNIQUE constraint failed') ||
          causeMessage.includes('duplicate key value')
        ) {
          throw new ConflictError('File ini sudah pernah disimpan sebelumnya')
        }
        throw err
      }
    },

    findByUserId: async (userId: number): Promise<FileRecord[]> => {
      return await db
        .select()
        .from(files)
        .where(eq(files.userId, userId))
        .orderBy(files.createdAt)
    },

    findById: async (id: number): Promise<FileRecord | null> => {
      const result = await db
        .select()
        .from(files)
        .where(eq(files.id, id))
        .limit(1)
      return result[0] ?? null
    },

    deleteById: async (id: number): Promise<void> => {
      await db
        .delete(files)
        .where(eq(files.id, id))
    },
  }
}
