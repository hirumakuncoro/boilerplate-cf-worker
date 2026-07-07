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

/**
 * Result dari getUploadUrl — berisi presigned URL untuk PUT langsung dari client,
 * dan key yang harus disimpan di DB setelah upload sukses.
 */
export interface PresignedUploadResult {
  uploadUrl: string
  key: string
  /** Waktu kadaluarsa presigned URL dalam detik */
  expiresIn: number
  /** Ukuran maksimal file yang diizinkan dalam bytes (untuk divalidasi di client dan /save) */
  maxSize?: number
}

export interface IStorage {
  /** Upload file langsung dari Worker (cocok untuk file kecil atau server-side processing) */
  put(key: string, value: ReadableStream | ArrayBuffer | Blob, options?: UploadOptions): Promise<void>

  /** Download file */
  get(key: string): Promise<Blob | null>

  /** Hapus file */
  delete(key: string): Promise<void>

  /** List file dengan optional prefix */
  list(prefix?: string): Promise<StorageObject[]>

  /**
   * Kembalikan public URL — hanya valid jika bucket bersifat public.
   * Untuk private bucket, gunakan getSignedUrl().
   */
  getPublicUrl(key: string): string

  /**
   * Cek apakah file dengan key tertentu ada di storage.
   * Menggunakan HEAD request — tidak mengambil body file, sangat ringan.
   * @param key  Path/key file di bucket
   */
  exists(key: string): Promise<boolean>

  /**
   * Generate presigned URL untuk upload langsung dari client (PUT).
   * Worker tidak menyentuh body file sehingga memory tetap ringan.
   * @param key          Path/key file di bucket
   * @param contentType  MIME type file yang akan diupload
   * @param expiresIn    Durasi URL valid dalam detik (default 300)
   * @param maxSize      Ukuran maksimal file dalam bytes (opsional)
   */
  getUploadUrl(key: string, contentType: string, expiresIn?: number, maxSize?: number): Promise<PresignedUploadResult>

  /**
   * Generate presigned URL untuk download file private.
   * Gunakan ini untuk bucket private sebagai pengganti getPublicUrl().
   * @param key     Path/key file di bucket
   * @param expiresIn    Durasi URL valid dalam detik (default 3600)
   */
  getSignedUrl(key: string, expiresIn?: number): Promise<string>
}
