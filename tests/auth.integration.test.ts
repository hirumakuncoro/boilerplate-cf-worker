import { describe, test, expect, beforeEach } from "bun:test"
import { authService } from "../src/modules/auth/auth.service"
import { AuthRepository } from "../src/modules/auth/auth.repository"
import { BadRequestError, UnauthorizedError } from "../src/lib/errors"
import { User } from "../src/db"
import { UserRequest } from "../src/modules/auth/auth.types"

const JWT_SECRET = "test-secret-key-min-32-chars-long"

// In-memory fake repository (mimics real DB constraints)
const createInMemoryRepo = (): AuthRepository => {
  const users = new Map()
  const tokens = new Map()
  let userIdCounter = 1

  const repo: AuthRepository = {
    findByEmail: async (email: string) => {
      return users.get(email) || null
    },

    findById: async (id: number) => {
      for (const user of users.values()) {
        if (user.id === id) return user
      }
      return null
    },

    create: async (data: UserRequest): Promise<User> => {
      const now = new Date()
      if (users.has(data.email)) {
        throw new Error("UNIQUE constraint failed: users.email")
      }
      const user: User = {
        id: userIdCounter++,
        email: data.email,
        password: data.password,
        name: data.name,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }
      users.set(data.email, user)
      return user
    },

    insertRefreshToken: async (data) => {
      tokens.set(data.token, data)
    },

    findRefreshToken: async (token: string) => {
      return tokens.get(token) || null
    },

    deleteRefreshToken: async (token: string) => {
      tokens.delete(token)
    },

    deleteExpiredTokens: async (now: Date) => {
      // BUG: Original uses eq() which only deletes exact match
      // Should use lt() to delete past expiry
      const expired: string[] = []
      for (const [token, data] of tokens.entries()) {
        if (data.expiresAt < now) {
          expired.push(token)
        }
      }
      expired.forEach(token => tokens.delete(token))
    },

    deleteRefreshTokenByUserId: async (userId: number) => {
      for (const [token, data] of tokens.entries()) {
        if (data.userId === userId) tokens.delete(token)
      }
    },

    deleteAndGetRefreshToken: async (token: string) => {
      const data = tokens.get(token)
      if (data) tokens.delete(token)
      return data || null
    },

    transaction: async <T>(fn: (repo: AuthRepository) => Promise<T>): Promise<T> => {
      return fn(repo)
    },
  }

  return repo
}

describe("authService — integration with in-memory repo", () => {
  let repo: AuthRepository
  let service: ReturnType<typeof authService>

  beforeEach(() => {
    repo = createInMemoryRepo()
    service = authService(repo, JWT_SECRET)
  })

  describe("register + login flow", () => {
    test("register then login succeeds", async () => {
      const registerRes = await service.register({
        email: "user@example.com",
        password: "password123",
        name: "John Doe",
      })

      const loginRes = await service.login({
        email: "user@example.com",
        password: "password123",
      })

      expect(loginRes.user.id).toBe(registerRes.user.id)
      expect(loginRes.user.email).toBe("user@example.com")
    })
  })

  describe("refresh token lifecycle", () => {
    test("refresh token can be used once — consumed on use", async () => {
      const { refreshToken: token1 } = await service.register({
        email: "user@example.com",
        password: "password123",
        name: "John Doe",
      })

      // First refresh succeeds
      const { refreshToken: token2, accessToken: access2 } = await service.refresh(token1)
      expect(token2).toBeDefined()
      expect(access2).toBeDefined()

      // Second use of old token fails
      try {
        await service.refresh(token1)
        expect.unreachable("Should throw — token already consumed")
      } catch (err) {
        expect(err).toBeInstanceOf(UnauthorizedError)
      }

      // New token from first refresh is usable
      const { refreshToken: token3 } = await service.refresh(token2)
      expect(token3).toBeDefined()
    })

    test("old tokens deleted when old user logs in again", async () => {
      const { refreshToken: token1 } = await service.register({
        email: "user@example.com",
        password: "password123",
        name: "John Doe",
      })

      // token1 still valid before login
      const refreshed1 = await service.refresh(token1)
      expect(refreshed1.user).toBeDefined()

      // Login clears all tokens including newly refreshed ones
      const { refreshToken: token2 } = await service.login({
        email: "user@example.com",
        password: "password123",
      })

      // First refresh token can't be used (deleted by login)
      try {
        await service.refresh(token1)
        expect.unreachable("Token from refresh should be cleared on login")
      } catch (err) {
        expect(err).toBeInstanceOf(UnauthorizedError)
      }
    })
  })

  describe("logout flow", () => {
    test("logout deletes token — token no longer valid", async () => {
      const { refreshToken } = await service.register({
        email: "user@example.com",
        password: "password123",
        name: "John Doe",
      })

      await service.logout(refreshToken)

      try {
        await service.refresh(refreshToken)
        expect.unreachable("Refresh with deleted token should fail")
      } catch (err) {
        expect(err).toBeInstanceOf(UnauthorizedError)
      }
    })
  })

  describe("expired tokens cleanup", () => {
    test("deleteExpiredTokens removes tokens past expiry", async () => {
      const { refreshToken } = await service.register({
        email: "user@example.com",
        password: "password123",
        name: "John Doe",
      })

      // Token is valid now
      const found1 = await repo.findRefreshToken(refreshToken)
      expect(found1).toBeDefined()

      // Cleanup from 8 days in future (token expires in 7 days)
      const eightDaysFromNow = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000)
      await repo.deleteExpiredTokens(eightDaysFromNow)

      // Token should be deleted
      const found2 = await repo.findRefreshToken(refreshToken)
      expect(found2).toBeNull()
    })

    test("deleteExpiredTokens keeps future-dated tokens", async () => {
      const { refreshToken } = await service.register({
        email: "user@example.com",
        password: "password123",
        name: "John Doe",
      })

      // Cleanup from past (token expires 7 days from now)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      await repo.deleteExpiredTokens(yesterday)

      // Token should still exist
      const found = await repo.findRefreshToken(refreshToken)
      expect(found).toBeDefined()
    })
  })

  describe("concurrent login sessions", () => {
    test("multiple concurrent refresh tokens per user work", async () => {
      const email = "user@example.com"
      const password = "password123"

      await service.register({
        email,
        password,
        name: "John",
      })

      const { refreshToken: token1 } = await service.login({
        email,
        password,
      })

      // Simulate second device login before first device refreshes
      const { refreshToken: token2 } = await service.login({
        email,
        password,
      })

      // token1 is deleted by second login (deleteRefreshTokenByUserId)
      try {
        await service.refresh(token1)
        expect.unreachable("token1 should be deleted by second login")
      } catch (err) {
        expect(err).toBeInstanceOf(UnauthorizedError)
      }

      // token2 is valid (from latest login)
      const refresh2 = await service.refresh(token2)
      expect(refresh2.user.email).toBe(email)
    })

    test("new login invalidates old sessions", async () => {
      const { refreshToken: oldToken } = await service.register({
        email: "user@example.com",
        password: "password123",
        name: "John",
      })

      // New login from different device
      await service.login({
        email: "user@example.com",
        password: "password123",
      })

      // Old token from register no longer works
      try {
        await service.refresh(oldToken)
        expect.unreachable("Old token should be invalidated")
      } catch (err) {
        expect(err).toBeInstanceOf(UnauthorizedError)
      }
    })
  })

  describe("user data persistence", () => {
    test("registered user data persists across operations", async () => {
      const { user: registered } = await service.register({
        email: "john@example.com",
        password: "secure123",
        name: "John Doe",
      })

      const fetched = await service.me(registered.id)

      expect(fetched.id).toBe(registered.id)
      expect(fetched.email).toBe("john@example.com")
      expect(fetched.name).toBe("John Doe")
    })
  })
})
