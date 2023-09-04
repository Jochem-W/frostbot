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

export const actionsEnum = pgEnum("actionsEnum", [
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
  guildId: text("guildId").notNull(),
  userId: text("userId").notNull(),
  action: actionsEnum("action").notNull(),
  body: text("body"),
  dm: boolean("dm").notNull(),
  staffId: text("staffId").notNull(),
  timeout: integer("timeout"),
  timestamp: timestamp("timestamp").notNull(),
  dmSuccess: boolean("dmSuccess").notNull(),
  actionSucess: boolean("actionSuccess").notNull(),
  deleteMessageSeconds: integer("deleteMessageSecconds").notNull(),
})

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  xp: integer("xp").notNull(),
  name: text("name").notNull(),
  avatar: text("avatar"),
  discriminator: text("discriminator").notNull(),
  member: boolean("member").notNull(),
})

export const insertActionsSchema = createInsertSchema(actionsTable)
