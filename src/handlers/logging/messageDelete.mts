import { Colours } from "../../models/colours.mjs"
import { Config } from "../../models/config.mjs"
import { handler } from "../../models/handler.mjs"
import { fetchChannel, tryFetchMember } from "../../util/discord.mjs"
import {
  ChannelType,
  EmbedBuilder,
  channelMention,
  type TextChannel,
  ActionRowBuilder,
  type MessageActionRowComponentBuilder,
  ButtonBuilder,
  ButtonStyle,
  italic,
  userMention,
  hyperlink,
} from "discord.js"
import { MIMEType } from "util"

let logChannel: TextChannel | undefined

export const MessageDeleteHandler = handler({
  event: "messageDelete",
  once: false,
  async handle(message) {
    logChannel ??= await fetchChannel(
      message.client,
      Config.channels.logs,
      ChannelType.GuildText,
    )

    if (!message.guildId || message.guildId !== Config.guild) {
      return
    }

    if (message.author?.bot) {
      return
    }

    const embeds = message.attachments
      .filter(
        (a) => a.contentType && new MIMEType(a.contentType).type === "image",
      )
      .map((a) => new EmbedBuilder().setURL(message.url).setImage(a.url))

    let firstEmbed = embeds[0]
    if (!firstEmbed) {
      firstEmbed = new EmbedBuilder()
      embeds.push(firstEmbed)
    } else if (embeds.length === 1) {
      firstEmbed.setURL(null)
    }

    firstEmbed
      .setTitle("🗑️ Message deleted")
      .setColor(Colours.red[500])
      .setFooter({ text: message.id })
      .setTimestamp(Date.now())

    if (message.attachments.size > 0) {
      const longAttachments = message.attachments
        .map((a) => `- ${hyperlink(a.name, a.url)}`)
        .join("\n")
      const shorterAttachments = message.attachments
        .map((a) => `- ${a.url}`)
        .join("\n")
      const shortestAttachments = message.attachments
        .map((a) => `- ${a.name}`)
        .join("\n")

      firstEmbed.addFields({
        name: "Attachments",
        value:
          longAttachments.length <= 1024
            ? longAttachments
            : shorterAttachments.length <= 1024
              ? shorterAttachments
              : shortestAttachments,
      })
    }

    if (message.content === null) {
      firstEmbed.setDescription(italic("Not cached"))
    } else {
      firstEmbed.setDescription(message.content || null)
    }

    if (message.author) {
      const member = await tryFetchMember(logChannel.guild, message.author)
      firstEmbed
        .setAuthor({
          name: (member ?? message.author).displayName,
          iconURL: (member ?? message.author).displayAvatarURL({ size: 4096 }),
        })
        .addFields(
          { name: "User", value: userMention(message.author.id), inline: true },
          { name: "User ID", value: message.author.id, inline: true },
        )
    }

    firstEmbed.addFields({
      name: "Channel",
      value: channelMention(message.channelId),
      inline: true,
    })

    await logChannel.send({
      embeds,
      components: [
        new ActionRowBuilder<MessageActionRowComponentBuilder>().setComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setEmoji("🔗")
            .setLabel("Go to message")
            .setURL(message.url),
        ),
      ],
    })
  },
})
