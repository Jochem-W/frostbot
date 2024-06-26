/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { Drizzle } from "../clients.mjs"
import { handler } from "../models/handler.mjs"
import { usersTable } from "../schema.mjs"
import { eq } from "drizzle-orm"

export const UpdateLeaderboardOnLeave = handler({
  event: "guildMemberRemove",
  once: false,
  async handle({ user }) {
    if (user.bot) {
      return
    }

    await Drizzle.update(usersTable)
      .set({
        name: user.displayName,
        avatar: user.avatar,
        member: false,
      })
      .where(eq(usersTable.id, user.id))
  },
})
