import { describe, test, expect, mock, beforeEach } from "bun:test"
import { authRouter } from "../src/modules/auth/auth.handler"
import { BadRequestError, UnauthorizedError } from "../src/lib/errors"
import type { ApiResponse, AuthResponse, UserResponse } from "../src/modules/auth/auth.types"
import { errorHandler } from "../src/middlewares/error.middleware"
import { createAuthUtils } from "../src/lib/auth"

const createMockService = () => ({
  register: mock(async () => ({
    user: { id: 1, email: "user@example.com", name: "John" },
    accessToken: "access123",
    refreshToken: "refresh123",
  })),
  login: mock(async () => ({
    user: { id: 1, email: "user@example.com", name: "John" },
    accessToken: "access123",
    refreshToken: "refresh123",
  })),
  logout: mock(async () => null),
  refresh: mock(async () => ({
    user: { id: 1, email: "user@example.com", name: "John" },
    accessToken: "newaccess123",
    refreshToken: "newrefresh123",
  })),
  me: mock(async () => ({ id: 1, email: "user@example.com", name: "John" })),
})

let mockService: ReturnType<typeof createMockService>
let app: ReturnType<typeof authRouter>

const testEnv = { JWT_SECRET: "test-secret" }
const authUtils = createAuthUtils(testEnv.JWT_SECRET)

let validToken: string

beforeEach(async() => {
  mockService = createMockService()
  app = authRouter(() => mockService)
  app.onError(errorHandler)
  validToken = await authUtils.generateAccessToken(1)
})

describe("authRouter /register", () => {
  test("happy path — 201 with tokens", async () => {
    const res = await app.request(new Request("http://localhost/register", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com", password: "password123", name: "John Doe" }),
    }))

    expect(res.status).toBe(201)
    const { data } = await res.json() as ApiResponse<AuthResponse>
    expect(data.user.email).toBe("user@example.com")
    expect(data.accessToken).toBeDefined()
    expect(data.refreshToken).toBeDefined()
    expect(mockService.register).toHaveBeenCalledTimes(1)
  })

  test("rejects invalid email format — service not called", async () => {
    const res = await app.request(new Request("http://localhost/register", {
      method: "POST",
      body: JSON.stringify({ email: "invalid-email", password: "password123", name: "John" }),
    }))

    expect(res.status).toBe(422)
    expect(mockService.register).not.toHaveBeenCalled()
  })

  test("rejects password < 6 chars — service not called", async () => {
    const res = await app.request(new Request("http://localhost/register", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com", password: "short", name: "John" }),
    }))

    expect(res.status).toBe(422)
    expect(mockService.register).not.toHaveBeenCalled()
  })

  test("rejects empty name — service not called", async () => {
    const res = await app.request(new Request("http://localhost/register", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com", password: "password123", name: "" }),
    }))

    expect(res.status).toBe(422)
    expect(mockService.register).not.toHaveBeenCalled()
  })

  test("rejects duplicate email — 400 from service error", async () => {
    const mockService = {
      ...createMockService(),
      register: mock(async () => { throw new BadRequestError("Email sudah terdaftar") }),
    }
    const app = authRouter(() => mockService)

    const res = await app.request(new Request("http://localhost/register", {
      method: "POST",
      body: JSON.stringify({ email: "existing@example.com", password: "password123", name: "John" }),
    }))

    expect(res.status).toBe(400)
    expect(mockService.register).toHaveBeenCalledTimes(1)
  })
})

describe("authRouter /login", () => {
  test("happy path — 200 with tokens", async () => {
    const res = await app.request(new Request("http://localhost/login", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com", password: "password123" }),
    }))

    expect(res.status).toBe(200)
    const { data } = await res.json() as ApiResponse<AuthResponse>
    expect(data.accessToken).toBeDefined()
    expect(mockService.login).toHaveBeenCalledTimes(1)
  })

  test("rejects invalid credentials — 401 from service error", async () => {
    const mockService = {
      ...createMockService(),
      login: mock(async () => { throw new UnauthorizedError("Email atau password salah") }),
    }
    const app = authRouter(() => mockService)

    const res = await app.request(new Request("http://localhost/login", {
      method: "POST",
      body: JSON.stringify({ email: "wrong@example.com", password: "password123" }),
    }))

    expect(res.status).toBe(401)
  })

  test("rejects wrong password — 401 from service error", async () => {
    const mockService = {
      ...createMockService(),
      login: mock(async () => { throw new UnauthorizedError("Email atau password salah") }),
    }
    const app = authRouter(() => mockService)

    const res = await app.request(new Request("http://localhost/login", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com", password: "wrongpassword" }),
    }))

    expect(res.status).toBe(401)
  })
})

describe("authRouter /logout", () => {
  test("happy path — 204 no content", async () => {
    const res = await app.request(new Request("http://localhost/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken: "refresh123" }),
    }))

    expect(res.status).toBe(204)
    expect(mockService.logout).toHaveBeenCalledTimes(1)
  })

  test("rejects missing refreshToken — service not called", async () => {
    const res = await app.request(new Request("http://localhost/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken: "" }),
    }))

    expect(res.status).toBe(422)
    expect(mockService.logout).not.toHaveBeenCalled()
  })
})

describe("authRouter /refresh", () => {
  test("happy path — 200 with new tokens", async () => {
    const res = await app.request(new Request("http://localhost/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken: "oldrefresh123" }),
    }))

    expect(res.status).toBe(200)
    const { data } = await res.json() as ApiResponse<AuthResponse>
    expect(data.accessToken).toBeDefined()
    expect(data.refreshToken).toBeDefined()
    expect(mockService.refresh).toHaveBeenCalledTimes(1)
  })

  test("rejects invalid refresh token — 401 from service error", async () => {
    const mockService = {
      ...createMockService(),
      refresh: mock(async () => { throw new UnauthorizedError("Refresh token tidak valid atau expired") }),
    }
    const app = authRouter(() => mockService)

    const res = await app.request(new Request("http://localhost/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken: "invalid-token" }),
    }))

    expect(res.status).toBe(401)
  })
})

describe("authRouter /me", () => {
  test("happy path — 200 with user data", async () => {
    const res = await app.request(new Request("http://localhost/me", {
      method: "GET",
      headers: { Authorization: "Bearer " + validToken },
    }), {}, testEnv)

    expect(res.status).toBe(200)
    const { data } = await res.json() as ApiResponse<UserResponse>
    expect(data.email).toBe("user@example.com")
    expect(mockService.me).toHaveBeenCalledTimes(1)
  })

  test("rejects missing auth header — 401, service not called", async () => {
    const res = await app.request(new Request("http://localhost/me", { method: "GET" }))

    expect(res.status).toBe(401)
    expect(mockService.me).not.toHaveBeenCalled()
  })

  test("rejects invalid bearer format — 401, service not called", async () => {
    const res = await app.request(new Request("http://localhost/me", {
      method: "GET",
      headers: { Authorization: "InvalidFormat token" },
    }))

    expect(res.status).toBe(401)
    expect(mockService.me).not.toHaveBeenCalled()
  })
})
