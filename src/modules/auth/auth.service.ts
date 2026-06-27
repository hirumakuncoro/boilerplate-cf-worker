import { Context } from 'hono'
import { Env } from '../../config/env'
import { authRepository } from './auth.repository'
import { createAuthUtils } from '../../lib/auth'
import { BadRequestError, UnauthorizedError } from '../../lib/errors'

export const authService = (c: Context<Env>) => {
  const repo = authRepository(c)
  const auth = createAuthUtils(c)

  return {
    register: async (data: { email: string; password: string; name: string }) => {
      const existingUser = await repo.findByEmail(data.email)
      if (existingUser) {
        throw new BadRequestError('Email sudah terdaftar')
      }

      const hashedPassword = await auth.hashPassword(data.password)

      const user = await repo.create({
        email: data.email,
        password: hashedPassword,
        name: data.name,
      })

      const accessToken = await auth.generateAccessToken(user.id)
      const refreshToken = await auth.generateRefreshToken(user.id)

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        accessToken,
        refreshToken,
      }
    },

    login: async (data: { email: string; password: string }) => {
      const user = await repo.findByEmail(data.email)
      if (!user) {
        throw new UnauthorizedError('Email atau password salah')
      }

      const isPasswordValid = await auth.verifyPassword(data.password, user.password)
      if (!isPasswordValid) {
        throw new UnauthorizedError('Email atau password salah')
      }

      const accessToken = await auth.generateAccessToken(user.id)
      const refreshToken = await auth.generateRefreshToken(user.id)

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        accessToken,
        refreshToken,
      }
    },

    logout: async (refreshToken: string) => {
      await auth.revokeRefreshToken(refreshToken)
      return null
    },

    refresh: async (refreshToken: string) => {
      const decoded = await auth.verifyRefreshToken(refreshToken)
      if (!decoded) throw new UnauthorizedError('Refresh token tidak valid atau expired')

      const user = await repo.findById(decoded.userId)
      if (!user) throw new UnauthorizedError('User tidak ditemukan')

      await auth.revokeRefreshToken(refreshToken)
      const newAccessToken = await auth.generateAccessToken(user.id)
      const newRefreshToken = await auth.generateRefreshToken(user.id)

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      }
    },

    me: async (userId: number) => {
      const user = await repo.findById(userId)
      if (!user) throw new UnauthorizedError('User tidak ditemukan')
      return { id: user.id, email: user.email, name: user.name }
    },
  }
}
