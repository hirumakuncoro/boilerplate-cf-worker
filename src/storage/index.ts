import { IStorage } from './IStorage'
import { R2Storage } from './r2.storage'
import { MinioStorage } from './minio.storage'
import { Context } from 'hono'
import { Env } from '../config/env'

export const getStorage = (c: Context<Env>): IStorage => {
  const env = c.env
  const driver = (env.STORAGE_DRIVER as string) || 'r2'

  if (driver === 'r2') {
    if (!env.BUCKET) throw new Error('R2 binding "BUCKET" tidak ditemukan di wrangler.jsonc')

    const s3Config =
      env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET_NAME
        ? {
            accountId: env.R2_ACCOUNT_ID,
            accessKeyId: env.R2_ACCESS_KEY_ID,
            secretAccessKey: env.R2_SECRET_ACCESS_KEY,
            bucketName: env.R2_BUCKET_NAME,
          }
        : undefined

    return new R2Storage(env.BUCKET, env.STORAGE_PUBLIC_URL, s3Config)
  }

  if (driver === 'minio') {
    return new MinioStorage(
      env.MINIO_ENDPOINT,
      env.MINIO_BUCKET,
      env.MINIO_ACCESS_KEY,
      env.MINIO_SECRET_KEY,
      env.STORAGE_PUBLIC_URL,
    )
  }

  throw new Error(`STORAGE_DRIVER "${driver}" tidak dikenal. Gunakan "r2" atau "minio"`)
}

export type { IStorage }
