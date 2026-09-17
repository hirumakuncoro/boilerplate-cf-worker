import { createAuthUtils } from '../../lib/auth'
import { BadRequestError, UnauthorizedError } from '../../lib/errors'
import { AuthRepository } from './auth.repository'

type UserResponse = {
  id: number
  email: string
  name: string
}

const toUserResponse = (user: UserResponse) => ({
  id: user.id,
  email: user.email,
  name: user.name,
})

export const authService = (repo: AuthRepository, secret: string) => {
  const auth = createAuthUtils(secret)

  return {
    register: async (data: { email: string; password: string; name: string }) => {
      const existingUser = await repo.findByEmail(data.email)
      if (existingUser) {
        throw new BadRequestError('Email sudah terdaftar')
      }

      const hashedPassword = await auth.hashPassword(data.password)
      const result = await repo.transaction(async (txRepo) => {
        const user = await txRepo.create({
          email: data.email,
          password: hashedPassword,
          name: data.name,
        })

        const accessToken = await auth.generateAccessToken(user.id)
        const refreshToken = await auth.generateRefreshToken(user.id)

        await txRepo.insertRefreshToken({
          token: refreshToken,
          userId: user.id,
          expiresAt: auth.refreshTokenExpiresAt(),
        })

        return { user, accessToken, refreshToken }
      })

      const { user, accessToken, refreshToken } = result
      return {
        user: toUserResponse(user),
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

      await repo.transaction(async (txRepo) => {
        await txRepo.deleteRefreshTokenByUserId(user.id)
        await txRepo.insertRefreshToken({
          token: refreshToken,
          userId: user.id,
          expiresAt: auth.refreshTokenExpiresAt(),
        })
      })

      return {
        user: toUserResponse(user),
        accessToken,
        refreshToken,
      }
    },

    logout: async (refreshToken: string) => {
      await repo.deleteRefreshToken(refreshToken)
      return null
    },

    refresh: async (refreshToken: string) => {
      const deletedToken = await repo.deleteAndGetRefreshToken(refreshToken)
      if (!deletedToken) throw new UnauthorizedError('Refresh token tidak valid atau expired')

      const decoded = await auth.verifyRefreshToken(refreshToken)
      if (!decoded) throw new UnauthorizedError('Refresh token tidak valid atau expired')

      const user = await repo.findById(decoded.userId)
      if (!user) throw new UnauthorizedError('User tidak ditemukan')

      const newAccessToken = await auth.generateAccessToken(user.id)
      const newRefreshToken = await auth.generateRefreshToken(user.id)
      await repo.insertRefreshToken({
        token: newRefreshToken,
        userId: user.id,
        expiresAt: auth.refreshTokenExpiresAt(),
      })

      return {
        user: toUserResponse(user),
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      }
    },

    me: async (userId: number) => {
      const user = await repo.findById(userId)
      if (!user) throw new UnauthorizedError('User tidak ditemukan')
      return toUserResponse(user)
    },
  }
}
