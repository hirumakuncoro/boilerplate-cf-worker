import { pgTable, text, timestamp, serial, integer } from 'drizzle-orm/pg-core'
import { users } from './users'

export const files = pgTable('files', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  fileName: text('file_name').notNull(),
  fileKey: text('file_key').notNull().unique(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export type FileRecord = typeof files.$inferSelect
export type NewFileRecord = typeof files.$inferInsert
