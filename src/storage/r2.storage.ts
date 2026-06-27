import { IStorage, UploadOptions, StorageObject } from './IStorage'

export class R2Storage implements IStorage {
  constructor(
    private bucket: R2Bucket,
    private publicUrl: string
  ) {}

  async put(
    key: string,
    value: ReadableStream | ArrayBuffer | Blob,
    options?: UploadOptions
  ): Promise<void> {
    await this.bucket.put(key, value, {
      httpMetadata: { contentType: options?.contentType },
      customMetadata: options?.metadata,
    })
  }

  async get(key: string): Promise<Blob | null> {
    const object = await this.bucket.get(key)
    if (!object) return null
    return await object.blob()
  }

  async delete(key: string): Promise<void> {
    await this.bucket.delete(key)
  }

  async list(prefix?: string): Promise<StorageObject[]> {
    const result = await this.bucket.list({ prefix })
    return result.objects.map((obj) => ({
      key: obj.key,
      size: obj.size,
      uploadedAt: obj.uploaded,
      contentType: obj.httpMetadata?.contentType,
      metadata: obj.customMetadata,
    }))
  }

  getPublicUrl(key: string): string {
    return `${this.publicUrl}/${key}`
  }
}
