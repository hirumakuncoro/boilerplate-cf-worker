import { users, User, NewUser, RefreshToken, refreshTokens, NewRefreshToken } from '../../db'
import { eq, lt } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

export type Db = ReturnType<typeof getDb>
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
export type DbOrTx = PgDatabase<PgQueryResultHKT, any, any>

export interface AuthRepository {
  findByEmail: (email: string) => Promise<User | null>
  findById: (id: number) => Promise<User | null>
  create: (data: NewUser) => Promise<User>
  insertRefreshToken: (data: NewRefreshToken) => Promise<void>
  findRefreshToken: (token: string) => Promise<RefreshToken | null>
  deleteRefreshToken: (token: string) => Promise<void>
  deleteExpiredTokens: (now: Date) => Promise<void>
  deleteRefreshTokenByUserId: (userId: number) => Promise<void>
  deleteAndGetRefreshToken: (token: string) => Promise<RefreshToken | null>
  transaction: <T>(fn: (repo: AuthRepository) => Promise<T>) => Promise<T>
}

export const authRepository = (db: DbOrTx): AuthRepository => ({
  transaction: async <T>(fn: (repo: AuthRepository) => Promise<T>) => {
    return (db as Db).transaction(async (tx) => fn(authRepository(tx)))
  },

  findByEmail: async (email: string): Promise<User | null> => {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
    return result[0] ?? null
  },

  findById: async (id: number): Promise<User | null> => {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)
    return result[0] ?? null
  },

  create: async (data: NewUser): Promise<User> => {
    const result = await db
      .insert(users)
      .values({
        email: data.email,
        password: data.password,
        name: data.name,
      } satisfies NewUser)
      .returning()

    return result[0]
  },

  insertRefreshToken: async (data: NewRefreshToken) => {
    await db.insert(refreshTokens).values(data)
  },

  findRefreshToken: async (token: string) => {
    const result = await db.select().from(refreshTokens).where(eq(refreshTokens.token, token)).limit(1)
    return result[0] ?? null
  },

  deleteRefreshToken: async (token: string) => {
    await db.delete(refreshTokens).where(eq(refreshTokens.token, token))
  },

  deleteRefreshTokenByUserId: async (userId: number) => {
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId))
  },

  deleteExpiredTokens: async (now: Date) => {
    await db.delete(refreshTokens).where(lt(refreshTokens.expiresAt, now))
  },

  deleteAndGetRefreshToken: async (token: string) => {
    const [deleted] = await db.delete(refreshTokens)
      .where(eq(refreshTokens.token, token))
      .returning()
    return deleted ?? null
  }
})
