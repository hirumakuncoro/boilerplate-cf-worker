import { IStorage, UploadOptions, StorageObject } from './IStorage'

export class MinioStorage implements IStorage {
  constructor(
    private endpoint: string,
    private bucket: string,
    private accessKey: string,
    private secretKey: string,
    private publicUrl: string
  ) {}

  private async getSignedHeaders(
    method: string,
    key: string,
    contentType?: string
  ): Promise<Headers> {
    const date = new Date().toUTCString()
    const headers = new Headers()
    headers.set('Host', new URL(this.endpoint).host)
    headers.set('Date', date)
    if (contentType) headers.set('Content-Type', contentType)
    return headers
  }

  async put(
    key: string,
    value: ReadableStream | ArrayBuffer | Blob,
    options?: UploadOptions
  ): Promise<void> {
    const url = `${this.endpoint}/${this.bucket}/${key}`
    const headers = await this.getSignedHeaders('PUT', key, options?.contentType)

    const res = await fetch(url, {
      method: 'PUT',
      headers,
      body: value,
    })

    if (!res.ok) throw new Error(`MinIO put failed: ${res.statusText}`)
  }

  async get(key: string): Promise<Blob | null> {
    const url = `${this.endpoint}/${this.bucket}/${key}`
    const headers = await this.getSignedHeaders('GET', key)

    const res = await fetch(url, { method: 'GET', headers })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`MinIO get failed: ${res.statusText}`)

    return await res.blob()
  }

  async delete(key: string): Promise<void> {
    const url = `${this.endpoint}/${this.bucket}/${key}`
    const headers = await this.getSignedHeaders('DELETE', key)

    const res = await fetch(url, { method: 'DELETE', headers })
    if (!res.ok) throw new Error(`MinIO delete failed: ${res.statusText}`)
  }

  async list(prefix?: string): Promise<StorageObject[]> {
    const url = new URL(`${this.endpoint}/${this.bucket}`)
    if (prefix) url.searchParams.set('prefix', prefix)
    url.searchParams.set('list-type', '2')

    const headers = await this.getSignedHeaders('GET', '')
    const res = await fetch(url.toString(), { method: 'GET', headers })
    if (!res.ok) throw new Error(`MinIO list failed: ${res.statusText}`)

    const text = await res.text()
    const keys = [...text.matchAll(/<Key>(.*?)<\/Key>/g)].map((m) => m[1])
    const sizes = [...text.matchAll(/<Size>(.*?)<\/Size>/g)].map((m) => Number(m[1]))
    const dates = [...text.matchAll(/<LastModified>(.*?)<\/LastModified>/g)].map((m) => new Date(m[1]))

    return keys.map((key, i) => ({
      key,
      size: sizes[i] ?? 0,
      uploadedAt: dates[i] ?? new Date(),
    }))
  }

  getPublicUrl(key: string): string {
    return `${this.publicUrl}/${key}`
  }
}
