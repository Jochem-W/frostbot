import { Drizzle } from "../clients.mjs"
import { Colours } from "../models/colours.mjs"
import { Config } from "../models/config.mjs"
import { handler } from "../models/handler.mjs"
import { usersTable } from "../schema.mjs"
import { levelForTotalXp, totalXpForLevel } from "../util/xp.mjs"
import { EmbedBuilder, MessageFlags, roleMention } from "discord.js"
import { sql } from "drizzle-orm"

export const XpHandler = handler({
  event: "messageCreate",
  once: false,
  async handle(message) {
    if (message.author.bot || !message.inGuild() || !message.member) {
      return
    }

    const difference = 1

    const [user] = await Drizzle.insert(usersTable)
      .values({
        id: message.author.id,
        xp: difference,
        name: message.author.displayName,
        avatar: message.author.avatar,
        member: true,
        discriminator: message.author.discriminator,
      })
      .onConflictDoUpdate({
        target: usersTable.id,
        set: { xp: sql`${usersTable.xp} + ${difference}` },
      })
      .returning()
    if (!user) {
      return
    }

    const level = levelForTotalXp(user.xp)
    if (user.xp - difference >= totalXpForLevel(level)) {
      return
    }

    let description = `You are now level ${level}`

    const role = Config.levelRoles.get(level.toString(10))
    if (role && !message.member.roles.cache.has(role)) {
      await message.member.roles.add(role)
      description += ` and were given the ${roleMention(role)} role`
    }

    description += "!"

    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setAuthor({
            name: "Level up!",
            iconURL: message.author.displayAvatarURL(),
          })
          .setDescription(description)
          .setColor(Colours.blue[400]),
      ],
      flags: [MessageFlags.SuppressNotifications],
    })
  },
})
