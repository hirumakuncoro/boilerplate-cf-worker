import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js'
import { drizzle as drizzleD1 } from 'drizzle-orm/d1'
import postgres from 'postgres'
import * as schema from './index'
import { Env } from '../config/env'
import { Context } from 'hono'

type AnyDrizzle = ReturnType<typeof drizzlePg<any>> & ReturnType<typeof drizzleD1<any>>

export const getDb = (c: Context<Env>): AnyDrizzle => {
  const env = c.env
  const dbDriver = (env.DB_DRIVER as string) || 'd1'

  if (dbDriver === 'pg') {
    const connectionString = (env as any).HYPERDRIVE?.connectionString ?? env.DATABASE_URL
    if (!connectionString) throw new Error('DATABASE_URL diperlukan untuk mode pg')
    const client = postgres(connectionString, { prepare: false })
    return drizzlePg(client, { schema }) as unknown as AnyDrizzle
  }

  if (dbDriver === 'd1') {
    if (!env.DB) {
      throw new Error('D1 binding "DB" tidak ditemukan di wrangler.jsonc')
    }
    return drizzleD1(env.DB, { schema }) as unknown as AnyDrizzle
  }

  throw new Error(`DB_DRIVER "${dbDriver}" tidak dikenal. Gunakan "pg" atau "d1"`)
}
