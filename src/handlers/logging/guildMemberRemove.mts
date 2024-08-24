import { Colours } from "../../models/colours.mjs"
import { Config } from "../../models/config.mjs"
import { handler } from "../../models/handler.mjs"
import { concatenate, fetchChannel } from "../../util/discord.mjs"
import {
  ChannelType,
  EmbedBuilder,
  TextChannel,
  TimestampStyles,
  roleMention,
  time,
  userMention,
} from "discord.js"

let logChannel: TextChannel | undefined

export const GuildMemberRemoveHandler = handler({
  event: "guildMemberRemove",
  once: false,
  async handle(member) {
    if (!Config.channels.logs) {
      return
    }

    logChannel ??= await fetchChannel(
      member.client,
      Config.channels.logs,
      ChannelType.GuildText,
    )

    if (member.guild.id !== Config.guild) {
      return
    }

    if (!member.user.banner) {
      await member.user.fetch()
    }

    const embed = new EmbedBuilder()
      .setAuthor({
        name: member.displayName,
        iconURL: member.displayAvatarURL({ size: 4096 }),
      })
      .setTitle("⬅️ Member left")
      .setThumbnail(member.displayAvatarURL({ size: 4096 }))
      .setDescription(userMention(member.id))
      .setImage(member.user.bannerURL({ size: 4096 }) ?? null)
      .setColor(Colours.red[500])
      .setFooter({ text: member.id })
      .setTimestamp(Date.now())

    if (member.joinedAt) {
      embed.setFields({
        name: "Joined at",
        value: time(member.joinedAt, TimestampStyles.ShortDateTime),
      })
    }

    const roles = concatenate(
      member.roles.cache
        .filter((r) => r.id !== member.guild.roles.everyone.id)
        .values(),
      (item) => `\n- ${roleMention(item.id)}`,
      1024,
    )

    if (roles) {
      embed.addFields({
        name: "Roles",
        value: roles,
      })
    }

    await logChannel.send({
      embeds: [embed],
    })
  },
})
