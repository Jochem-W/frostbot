import { Drizzle } from "../clients.mjs"
import { handler } from "../models/handler.mjs"
import { usersTable } from "../schema.mjs"

export const MemberAddHandler = handler({
  event: "guildMemberAdd",
  once: false,
  async handle({ user }) {
    await Drizzle.insert(usersTable)
      .values({
        id: user.id,
        xp: 0,
        name: user.displayName,
        avatar: user.avatar,
        member: true,
      })
      .onConflictDoUpdate({
        target: usersTable.id,
        set: {
          name: user.displayName,
          avatar: user.avatar,
          member: true,
        },
      })
  },
})
