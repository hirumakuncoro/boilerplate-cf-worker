import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { IStorage, UploadOptions, StorageObject, PresignedUploadResult } from './IStorage'

export class MinioStorage implements IStorage {
  private client: S3Client

  constructor(
    private endpoint: string,
    private bucket: string,
    accessKey: string,
    secretKey: string,
    private publicUrl: string,
  ) {
    this.client = new S3Client({
      endpoint: this.endpoint,
      region: 'auto',
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      // Wajib untuk MinIO/S3-compatible: pakai path-style URL (bukan virtual-hosted)
      forcePathStyle: true,
    })
  }

  async put(
    key: string,
    value: ReadableStream | ArrayBuffer | Blob,
    options?: UploadOptions
  ): Promise<void> {
    let body: Uint8Array
    if (value instanceof Blob) {
      body = new Uint8Array(await value.arrayBuffer())
    } else if (value instanceof ArrayBuffer) {
      body = new Uint8Array(value)
    } else {
      const resp = new Response(value)
      body = new Uint8Array(await resp.arrayBuffer())
    }

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: options?.contentType,
        Metadata: options?.metadata,
      })
    )
  }

  async get(key: string): Promise<Blob | null> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key })
      )
      if (!res.Body) return null
      const bytes = await res.Body.transformToByteArray()
      return new Blob([bytes], { type: res.ContentType })
    } catch (err: any) {
      if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) return null
      throw err
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
    )
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key })
      )
      return true
    } catch (err: any) {
      if (err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) return false
      throw err
    }
  }

  async list(prefix?: string): Promise<StorageObject[]> {
    const res = await this.client.send(
      new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix })
    )

    return (res.Contents ?? []).map((obj) => ({
      key: obj.Key ?? '',
      size: obj.Size ?? 0,
      uploadedAt: obj.LastModified ?? new Date(),
    }))
  }

  getPublicUrl(key: string): string {
    return `${this.publicUrl}/${key}`
  }

  async getUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 300,
    maxSize?: number
  ): Promise<PresignedUploadResult> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    })

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn })

    return { uploadUrl, key, expiresIn, maxSize }
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key })
    return getSignedUrl(this.client, command, { expiresIn })
  }
}
