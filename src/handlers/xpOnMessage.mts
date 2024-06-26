/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { Drizzle } from "../clients.mjs"
import { Colours } from "../models/colours.mjs"
import { Config } from "../models/config.mjs"
import { handler } from "../models/handler.mjs"
import { usersTable } from "../schema.mjs"
import { levelForTotalXp, totalXpForLevel } from "../util/xp.mjs"
import TTLCache from "@isaacs/ttlcache"
import { EmbedBuilder, MessageFlags, roleMention } from "discord.js"
import { sql } from "drizzle-orm"
import { Duration } from "luxon"

const times = new TTLCache<string, boolean>({
  ttl: Duration.fromObject({ seconds: Config.xp.time }).toMillis(),
})

export const XpOnMessage = handler({
  event: "messageCreate",
  once: false,
  async handle(message) {
    if (message.author.bot || !message.inGuild() || !message.member) {
      return
    }

    if (times.get(message.author.id)) {
      return
    }

    times.set(message.author.id, true)

    const difference = Math.floor(
      Math.max(
        Math.min(
          Math.E ** (Config.xp.curve * message.content.length),
          Config.xp.max,
          Math.E **
            (-Config.xp.curve * (message.content.length - Config.xp.dropoff)),
        ),
        Config.xp.min,
      ),
    )

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
