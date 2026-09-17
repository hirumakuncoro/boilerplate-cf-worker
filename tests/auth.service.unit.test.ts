import { describe, test, expect, beforeEach } from "bun:test"
import { authService } from "../src/modules/auth/auth.service"
import { AuthRepository } from "../src/modules/auth/auth.repository"
import { BadRequestError, UnauthorizedError } from "../src/lib/errors"
import { UserRequest } from "../src/modules/auth/auth.types"
import { User } from "../src/db"

const JWT_SECRET = "test-secret-key-min-32-chars-long"

const createFakeRepo = (): AuthRepository => {
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

    deleteExpiredTokens: async () => {},

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

describe("authService.register", () => {
  let repo: AuthRepository
  let service: ReturnType<typeof authService>

  beforeEach(() => {
    repo = createFakeRepo()
    service = authService(repo, JWT_SECRET)
  })

  test("happy path — creates user and returns tokens", async () => {
    const result = await service.register({
      email: "user@example.com",
      password: "password123",
      name: "John Doe",
    })

    expect(result.user.email).toBe("user@example.com")
    expect(result.user.name).toBe("John Doe")
    expect(result.accessToken).toBeDefined()
    expect(result.refreshToken).toBeDefined()
  })

  test("rejects duplicate email", async () => {
    await service.register({
      email: "user@example.com",
      password: "password123",
      name: "John Doe",
    })

    try {
      await service.register({
        email: "user@example.com",
        password: "different123",
        name: "Jane Doe",
      })
      expect.unreachable("Should throw BadRequestError")
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestError)
      expect((err as BadRequestError).message).toContain("Email sudah terdaftar")
    }
  })

  test("hashes password before storing", async () => {
    const plainPassword = "password123"
    await service.register({
      email: "user@example.com",
      password: plainPassword,
      name: "John Doe",
    })

    // Verify user was created (hashed password != plain)
    const user = await repo.findByEmail("user@example.com")
    expect(user!.password).not.toBe(plainPassword)
    expect(user!.password).toBeDefined()
  })
})

describe("authService.login", () => {
  let repo: AuthRepository
  let service: ReturnType<typeof authService>

  beforeEach(async () => {
    repo = createFakeRepo()
    service = authService(repo, JWT_SECRET)
    await service.register({
      email: "user@example.com",
      password: "password123",
      name: "John Doe",
    })
  })

  test("happy path — returns user and tokens", async () => {
    const result = await service.login({
      email: "user@example.com",
      password: "password123",
    })

    expect(result.user.email).toBe("user@example.com")
    expect(result.accessToken).toBeDefined()
    expect(result.refreshToken).toBeDefined()
  })

  test("rejects wrong email", async () => {
    try {
      await service.login({
        email: "wrong@example.com",
        password: "password123",
      })
      expect.unreachable("Should throw UnauthorizedError")
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedError)
    }
  })

  test("rejects wrong password", async () => {
    try {
      await service.login({
        email: "user@example.com",
        password: "wrongpassword",
      })
      expect.unreachable("Should throw UnauthorizedError")
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedError)
    }
  })

  test("rotates refresh tokens on login", async () => {
    const first = await service.login({
      email: "user@example.com",
      password: "password123",
    })

    const second = await service.login({
      email: "user@example.com",
      password: "password123",
    })

    expect(first.refreshToken).not.toBe(second.refreshToken)
  })
})

describe("authService.refresh", () => {
  let repo: AuthRepository
  let service: ReturnType<typeof authService>
  let refreshToken: string

  beforeEach(async () => {
    repo = createFakeRepo()
    service = authService(repo, JWT_SECRET)
    const registered = await service.register({
      email: "user@example.com",
      password: "password123",
      name: "John Doe",
    })
    refreshToken = registered.refreshToken
  })

  test("happy path — returns new tokens", async () => {
    const result = await service.refresh(refreshToken)

    expect(result.user.email).toBe("user@example.com")
    expect(result.accessToken).toBeDefined()
    expect(result.refreshToken).toBeDefined()
    expect(result.refreshToken).not.toBe(refreshToken)
  })

  test("rejects invalid refresh token", async () => {
    try {
      await service.refresh("invalid-token")
      expect.unreachable("Should throw UnauthorizedError")
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedError)
    }
  })

  test("token only usable once — consumed on refresh", async () => {
    // First refresh succeeds
    await service.refresh(refreshToken)

    // Second use fails — token already deleted
    try {
      await service.refresh(refreshToken)
      expect.unreachable("Should throw UnauthorizedError")
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedError)
    }
  })

  test("verifies token BEFORE deleting — rejects bad signature", async () => {
    const badToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInR5cGUiOiJyZWZyZXNoIn0.bad"

    try {
      await service.refresh(badToken)
      expect.unreachable("Should throw UnauthorizedError")
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedError)
    }

    // Old token still valid (was never deleted because verify failed first)
    const result = await service.refresh(refreshToken)
    expect(result.user.email).toBe("user@example.com")
  })
})

describe("authService.logout", () => {
  let repo: AuthRepository
  let service: ReturnType<typeof authService>
  let refreshToken: string

  beforeEach(async () => {
    repo = createFakeRepo()
    service = authService(repo, JWT_SECRET)
    const registered = await service.register({
      email: "user@example.com",
      password: "password123",
      name: "John Doe",
    })
    refreshToken = registered.refreshToken
  })

  test("happy path — deletes refresh token", async () => {
    const found = await repo.findRefreshToken(refreshToken)
    expect(found).toBeDefined()

    await service.logout(refreshToken)

    const notFound = await repo.findRefreshToken(refreshToken)
    expect(notFound).toBeNull()
  })

  test("logout with nonexistent token is noop", async () => {
    const result = await service.logout("nonexistent-token")
    expect(result).toBeNull()
  })
})

describe("authService.me", () => {
  let repo: AuthRepository
  let service: ReturnType<typeof authService>
  let userId: number

  beforeEach(async () => {
    repo = createFakeRepo()
    service = authService(repo, JWT_SECRET)
    const registered = await service.register({
      email: "user@example.com",
      password: "password123",
      name: "John Doe",
    })
    userId = registered.user.id
  })

  test("happy path — returns user data", async () => {
    const result = await service.me(userId)
    expect(result.email).toBe("user@example.com")
    expect(result.name).toBe("John Doe")
  })

  test("rejects nonexistent user", async () => {
    try {
      await service.me(9999)
      expect.unreachable("Should throw UnauthorizedError")
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedError)
    }
  })
})
