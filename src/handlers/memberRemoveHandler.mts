import { Drizzle } from "../clients.mjs"
import { handler } from "../models/handler.mjs"
import { usersTable } from "../schema.mjs"
import { eq } from "drizzle-orm"

export const MemberRemoveHandler = handler({
  event: "guildMemberRemove",
  once: false,
  async handle({ user }) {
    await Drizzle.update(usersTable)
      .set({
        name: user.displayName,
        avatar: user.avatar,
        member: false,
      })
      .where(eq(usersTable.id, user.id))
  },
})
