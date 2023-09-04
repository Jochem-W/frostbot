import { Drizzle } from "../clients.mjs"
import { handler } from "../models/handler.mjs"
import { usersTable } from "../schema.mjs"

export const UpdateLeaderboardOnJoin = handler({
  event: "guildMemberAdd",
  once: false,
  async handle({ user }) {
    if (user.bot) {
      return
    }

    await Drizzle.insert(usersTable)
      .values({
        id: user.id,
        xp: 0,
        name: user.displayName,
        avatar: user.avatar,
        member: true,
        discriminator: user.discriminator,
      })
      .onConflictDoUpdate({
        target: usersTable.id,
        set: {
          name: user.displayName,
          avatar: user.avatar,
          member: true,
          discriminator: user.discriminator,
        },
      })
  },
})
