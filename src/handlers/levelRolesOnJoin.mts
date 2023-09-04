import { Drizzle } from "../clients.mjs"
import { Config } from "../models/config.mjs"
import { handler } from "../models/handler.mjs"
import { usersTable } from "../schema.mjs"
import { levelForTotalXp } from "../util/xp.mjs"
import { eq } from "drizzle-orm"

export const LevelRolesOnJoin = handler({
  event: "guildMemberUpdate",
  once: false,
  async handle(oldMember, newMember) {
    if (
      !oldMember.pending ||
      newMember.pending ||
      oldMember.user.bot ||
      newMember.user.bot
    ) {
      return
    }

    const [user] = await Drizzle.select()
      .from(usersTable)
      .where(eq(usersTable.id, newMember.id))
    if (!user) {
      return
    }

    const level = levelForTotalXp(user.xp)
    await newMember.roles.add(
      [...Config.levelRoles.entries()]
        .filter(([k]) => parseInt(k) <= level)
        .map(([, v]) => v),
    )
  },
})
