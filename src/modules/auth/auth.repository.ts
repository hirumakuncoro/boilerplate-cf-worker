import { Context } from 'hono'
import { Env } from '../../config/env'
import { getDb } from '../../db/client'
import { users, User, NewUser } from '../../db'
import { eq } from 'drizzle-orm'

export const authRepository = (c: Context<Env>) => {
  const db = getDb(c)

  return {
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

    create: async (data: { email: string; password: string; name: string }): Promise<User> => {
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
  }
}
