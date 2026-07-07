import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { IStorage, UploadOptions, StorageObject, PresignedUploadResult } from './IStorage'

/**
 * R2Storage menggunakan @aws-sdk/client-s3 karena Cloudflare R2
 * kompatibel sepenuhnya dengan S3 API.
 *
 * Untuk presigned URL, R2 membutuhkan:
 *   - ACCOUNT_ID   : CF Account ID kamu
 *   - ACCESS_KEY_ID / SECRET_ACCESS_KEY : R2 API Token (buat di Cloudflare Dashboard)
 *
 * Endpoint format: https://<ACCOUNT_ID>.r2.cloudflarestorage.com
 */
export class R2Storage implements IStorage {
  private client?: S3Client

  constructor(
    /**
     * Native R2Bucket binding dari Cloudflare Workers — dipakai untuk
     * operasi put/get/delete/list di dalam Worker (zero-latency, tanpa HTTP).
     */
    private nativeBucket: R2Bucket,
    private publicUrl: string,
    /**
     * Konfigurasi S3Client untuk operasi presigned URL.
     * Wajib diisi jika ingin menggunakan getUploadUrl() / getSignedUrl().
     * Jika tidak diisi, kedua method akan melempar error.
     */
    s3Config?: {
      accountId: string
      accessKeyId: string
      secretAccessKey: string
      /** Nama bucket R2 (string, bukan binding) */
      bucketName: string
    }
  ) {
    if (s3Config) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${s3Config.accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: s3Config.accessKeyId,
          secretAccessKey: s3Config.secretAccessKey,
        },
      })
      this._bucketName = s3Config.bucketName
    }
  }

  /** Nama bucket untuk operasi S3 (presigned URL) */
  private _bucketName?: string

  // ---------------------------------------------------------------------------
  // Operasi native (menggunakan R2Bucket binding — ringan, zero HTTP overhead)
  // ---------------------------------------------------------------------------

  async put(
    key: string,
    value: ReadableStream | ArrayBuffer | Blob,
    options?: UploadOptions
  ): Promise<void> {
    await this.nativeBucket.put(key, value, {
      httpMetadata: { contentType: options?.contentType },
      customMetadata: options?.metadata,
    })
  }

  async get(key: string): Promise<Blob | null> {
    const object = await this.nativeBucket.get(key)
    if (!object) return null
    return await object.blob()
  }

  async delete(key: string): Promise<void> {
    await this.nativeBucket.delete(key)
  }

  async exists(key: string): Promise<boolean> {
    const object = await this.nativeBucket.head(key)
    return object !== null
  }

  async list(prefix?: string): Promise<StorageObject[]> {
    const result = await this.nativeBucket.list({ prefix })
    return result.objects.map((obj) => ({
      key: obj.key,
      size: obj.size,
      uploadedAt: obj.uploaded,
      contentType: obj.httpMetadata?.contentType,
      metadata: obj.customMetadata,
    }))
  }

  // ---------------------------------------------------------------------------
  // URL helpers
  // ---------------------------------------------------------------------------

  getPublicUrl(key: string): string {
    return `${this.publicUrl}/${key}`
  }

  // ---------------------------------------------------------------------------
  // Presigned URL (menggunakan S3Client — membutuhkan s3Config)
  // ---------------------------------------------------------------------------

  private assertS3Config(): void {
    if (!this.client || !this._bucketName) {
      throw new Error(
        'R2Storage: s3Config (accountId, accessKeyId, secretAccessKey, bucketName) ' +
          'wajib diisi untuk menggunakan getUploadUrl() atau getSignedUrl().'
      )
    }
  }

  /**
   * Generate presigned PUT URL sehingga client bisa upload langsung ke R2
   * tanpa melewati Worker — Worker tidak pernah menyentuh body file.
   * @param maxSize  Jika diisi, menambahkan header x-amz-content-sha256 constraint
   *                 via kondisi Content-Length di metadata presigned URL.
   *                 Catatan: R2 tidak mendukung policy condition seperti S3,
   *                 sehingga maxSize disertakan di response untuk divalidasi di /save.
   */
  async getUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 300,
    maxSize?: number
  ): Promise<PresignedUploadResult> {
    this.assertS3Config()

    const command = new PutObjectCommand({
      Bucket: this._bucketName!,
      Key: key,
      ContentType: contentType,
    })

    const uploadUrl = await getSignedUrl(this.client!, command, { expiresIn })
    return { uploadUrl, key, expiresIn, maxSize }
  }

  /**
   * Generate presigned GET URL untuk akses file private.
   * Gunakan ini sebagai pengganti getPublicUrl() untuk bucket private.
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    this.assertS3Config()

    const command = new GetObjectCommand({
      Bucket: this._bucketName!,
      Key: key,
    })

    return getSignedUrl(this.client!, command, { expiresIn })
  }
}
