import { Drizzle } from "../clients.mjs"
import { handler } from "../models/handler.mjs"
import { usersTable } from "../schema.mjs"

export const UserUpdateHandler = handler({
  event: "userUpdate",
  once: false,
  async handle(_old, user) {
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
