/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core"
import { createInsertSchema } from "drizzle-zod"

export const actionsEnum = pgEnum("actions_enum", [
  "unban",
  "kick",
  "warn",
  "timeout",
  "ban",
  "note",
  "restrain",
  "untimeout",
])

export const actionsTable = pgTable("actions", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  userId: text("user_id").notNull(),
  action: actionsEnum("action").notNull(),
  body: text("body"),
  dm: boolean("dm").notNull(),
  staffId: text("staff_id").notNull(),
  timeout: integer("timeout").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  dmSuccess: boolean("dm_success").notNull(),
  actionSucess: boolean("action_success").notNull(),
  deleteMessageSeconds: integer("delete_message_seconds").notNull(),
  timedOutUntil: timestamp("timed_out_until"),
  revoked: boolean("revoked").notNull().default(false),
  hidden: boolean("hidden").notNull().default(false),
})

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  xp: integer("xp").notNull(),
  name: text("name").notNull(),
  avatar: text("avatar"),
  discriminator: text("discriminator").notNull(),
  member: boolean("member").notNull(),
})

export const attachmentsTable = pgTable("attachments", {
  id: serial("id").primaryKey(),
  key: text("key").notNull(),
  actionId: integer("action_id")
    .notNull()
    .references(() => actionsTable.id),
})

export const actionLogsTable = pgTable("action_logs", {
  id: serial("id").primaryKey(),
  actionId: integer("action_id")
    .notNull()
    .references(() => actionsTable.id),
  messageId: text("message_id").notNull().unique(),
  channelId: text("channel_id").notNull(),
})

export const insertActionsSchema = createInsertSchema(actionsTable)
