import { Colours } from "../../models/colours.mjs"
import { Config } from "../../models/config.mjs"
import { handler } from "../../models/handler.mjs"
import { fetchChannel, tryFetchMember } from "../../util/discord.mjs"
import {
  ChannelType,
  EmbedBuilder,
  TextChannel,
  type MessageActionRowComponentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  italic,
  channelMention,
  userMention,
} from "discord.js"

let logChannel: TextChannel | undefined

export const MessageDeleteBulkHandler = handler({
  event: "messageDeleteBulk",
  once: false,
  async handle(messages, channel) {
    if (!Config.channels.logs) {
      return
    }

    if (channel.guildId !== Config.guild) {
      return
    }

    logChannel ??= await fetchChannel(
      channel.client,
      Config.channels.logs,
      ChannelType.GuildText,
    )

    const info = new EmbedBuilder()
      .setTitle(`🗑️ ${messages.size} messages deleted`)
      .setDescription(channelMention(channel.id))
      .setColor(Colours.red[500])
      .setTimestamp(Date.now())

    const firstMessage = messages.last()
    if (!firstMessage) {
      return
    }

    const first = new EmbedBuilder()
      .setTitle("First message")
      .setColor(Colours.red[500])
      .setDescription(
        firstMessage.content === null
          ? italic("Not cached")
          : firstMessage.content || null,
      )
      .setFooter({ text: firstMessage.id })
      .setTimestamp(firstMessage.createdAt)
    if (firstMessage.author) {
      const member = await tryFetchMember(channel.guild, firstMessage.author)
      first
        .setAuthor({
          name: (member ?? firstMessage.author).displayName,
          iconURL: (member ?? firstMessage.author).displayAvatarURL({
            size: 4096,
          }),
        })
        .addFields(
          {
            name: "User",
            value: userMention(firstMessage.author.id),
            inline: true,
          },
          { name: "User ID", value: firstMessage.author.id, inline: true },
        )
    }

    const lastMessage = messages.first()
    if (!lastMessage) {
      return
    }

    const last = new EmbedBuilder()
      .setTitle("Last message")
      .setColor(Colours.red[500])
      .setDescription(
        lastMessage.content === null
          ? italic("Not cached")
          : lastMessage.content || null,
      )
      .setFooter({ text: lastMessage.id })
      .setTimestamp(lastMessage.createdAt)
    if (lastMessage.author) {
      const member = await tryFetchMember(channel.guild, lastMessage.author)
      last
        .setAuthor({
          name: (member ?? lastMessage.author).displayName,
          iconURL: (member ?? lastMessage.author).displayAvatarURL({
            size: 4096,
          }),
        })
        .addFields(
          {
            name: "User",
            value: userMention(lastMessage.author.id),
            inline: true,
          },
          { name: "User ID", value: lastMessage.author.id, inline: true },
        )
    }

    await logChannel.send({
      embeds: [info, first, last],
      components: [
        new ActionRowBuilder<MessageActionRowComponentBuilder>().setComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setEmoji("🔗")
            .setLabel("Go to first message")
            .setURL(firstMessage.url),
        ),
      ],
    })
  },
})
