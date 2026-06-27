export interface UploadOptions {
  contentType?: string
  metadata?: Record<string, string>
}

export interface StorageObject {
  key: string
  size: number
  uploadedAt: Date
  contentType?: string
  metadata?: Record<string, string>
}

export interface IStorage {
  put(key: string, value: ReadableStream | ArrayBuffer | Blob, options?: UploadOptions): Promise<void>
  get(key: string): Promise<Blob | null>
  delete(key: string): Promise<void>
  list(prefix?: string): Promise<StorageObject[]>
  getPublicUrl(key: string): string
}
