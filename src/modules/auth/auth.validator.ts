import { z } from 'zod'

export const registerSchema = z.object({
  email: z.email('Format email tidak valid'),
  password: z
    .string()
    .min(6, 'Password minimal 6 karakter'),
  name: z
    .string()
    .min(1, 'Nama harus diisi')
    .max(100, 'Nama terlalu panjang'),
})

export const loginSchema = z.object({
  email: z.email('Format email tidak valid'),
  password: z
    .string()
    .min(1, 'Password wajib diisi'),
})

export const tokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token wajib diisi'),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type TokenInput = z.infer<typeof tokenSchema>
