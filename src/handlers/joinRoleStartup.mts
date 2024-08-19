import { Config } from "../models/config.mjs"
import { handler } from "../models/handler.mjs"
import { DateTime } from "luxon"

export const JoinRoleStartupHandler = handler({
  event: "ready",
  once: false,
  async handle(client) {
    const guild = await client.guilds.fetch(Config.guild)
    const members = await guild.members.fetch()
    for (const member of members.values()) {
      if (!member.joinedAt) {
        continue
      }

      const diff = DateTime.fromJSDate(member.joinedAt)
        .diffNow()
        .negate()
        .toMillis()
      await member.roles.add(
        Object.entries(Config.joinRoles)
          .filter(([, delay]) => delay <= diff)
          .map(([role]) => role),
      )
    }
  },
})
