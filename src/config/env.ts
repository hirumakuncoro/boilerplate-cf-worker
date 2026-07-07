import { Context } from 'hono'

export type DbDriver = 'd1' | 'pg'
export type StorageDriver = 'r2' | 'minio'

export type Env = {
  Bindings: CloudflareBindings & {
    DB_DRIVER: DbDriver
    DATABASE_URL: string
    JWT_SECRET: string
    // Storage
    STORAGE_DRIVER: StorageDriver
    STORAGE_PUBLIC_URL: string | undefined
    BUCKET: R2Bucket
    R2_ACCOUNT_ID: string
    R2_ACCESS_KEY_ID: string
    R2_SECRET_ACCESS_KEY: string
    R2_BUCKET_NAME: string
    // MinIO
    MINIO_ENDPOINT: string
    MINIO_BUCKET: string
    MINIO_ACCESS_KEY: string
    MINIO_SECRET_KEY: string
  },
  Variables: {
    userId: number
  }
}

export const getEnv = (c: Context<Env>) => {
  return c.env
}
