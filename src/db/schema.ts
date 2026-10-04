import { boolean, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Messages table in Google Cloud SQL
export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  displayName: text('display_name').notNull(),
  photoURL: text('photo_url'),
  text: text('text').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Users table in Google Cloud SQL
export const users = pgTable('users', {
  userId: text('user_id').primaryKey(),
  displayName: text('display_name').notNull(),
  lastActive: timestamp('last_active', { withTimezone: true }).defaultNow().notNull(),
});

// Typing state in Google Cloud SQL
export const typing = pgTable('typing', {
  userId: text('user_id').primaryKey(),
  displayName: text('display_name').notNull(),
  isTyping: boolean('is_typing').default(false).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
