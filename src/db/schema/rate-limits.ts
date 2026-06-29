import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core'

export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  attempts: integer('attempts').notNull().default(0),
  resetAt: timestamp('reset_at').notNull(),
})

export type RateLimit = typeof rateLimits.$inferSelect
export type NewRateLimit = typeof rateLimits.$inferInsert
