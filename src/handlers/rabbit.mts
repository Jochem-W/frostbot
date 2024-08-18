/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { Queue, ConsumerChannel, Drizzle } from "../clients.mjs"
import { Config } from "../models/config.mjs"
import { handler } from "../models/handler.mjs"
import { actionLogsTable } from "../schema.mjs"
import { fetchChannel } from "../util/discord.mjs"
import { logError } from "../util/error.mjs"
import { ConsumeMessage } from "amqplib"
import {
  APIEmbed,
  ChannelType,
  Client,
  EmbedBuilder,
  escapeStrikethrough,
  MessageCreateOptions,
  strikethrough,
} from "discord.js"
import { eq } from "drizzle-orm"

export const RabbitHandler = handler({
  event: "ready",
  once: true,
  async handle(client) {
    for (const guild of client.guilds.cache.values()) {
      await guild.members.fetch()
    }

    await ConsumerChannel.consume(
      Queue,
      (message) => consumer(client, message).catch((e) => logError(client, e)),
      { exclusive: true },
    )
  },
})

async function consumer(client: Client<true>, data: ConsumeMessage | null) {
  if (!data) {
    return
  }

  const parsed = JSON.parse(data.content.toString()) as AmpqMessage
  switch (parsed.type) {
    case "create":
      await create(client, parsed)
      break
    case "revoked":
      await revoked(client, parsed)
      break
    case "attachments":
      await attachments(client, parsed)
      break
  }

  ConsumerChannel.ack(data)
}

async function create(
  client: Client<true>,
  data: Extract<AmpqMessage, { type: "create" }>,
) {
  const { guild, target, content, id } = data

  const embed = content.embeds?.[0] as APIEmbed
  const authorName = embed?.author?.name

  for (const channelId of Config.channels.mod) {
    const channel = await fetchChannel(client, channelId, ChannelType.GuildText)

    if (channel.guildId !== guild.id) {
      console.log(channel, channel.guildId, guild.name, guild.id)
      if (!channel.guild.members.cache.has(target)) {
        continue
      }

      if (embed?.author?.name) {
        embed.author.name += ` in ${guild.name}`
      }
    }

    const message = await channel.send(content)

    if (id) {
      await Drizzle.insert(actionLogsTable).values({
        messageId: message.id,
        channelId: message.channelId,
        actionId: id,
      })
    }

    if (embed?.author?.name && authorName) {
      embed.author.name = authorName
    }
  }
}

async function revoked(
  client: Client<true>,
  data: Extract<AmpqMessage, { type: "revoked" }>,
) {
  const { id, content } = data

  const logs = await Drizzle.select()
    .from(actionLogsTable)
    .where(eq(actionLogsTable.actionId, id))
  for (const log of logs) {
    const channel = client.channels.cache.get(log.channelId)
    if (!channel?.isTextBased()) {
      continue
    }

    const message = await channel.messages.fetch(log.messageId)
    if (message.author.id !== client.user.id) {
      continue
    }

    const embeds = message.embeds.map((embed) => new EmbedBuilder(embed.data))
    const reasonField = embeds[0]?.data.fields?.find(
      (field) => field.name === "❔ Reason" || field.name === "🗒️ Body",
    )
    if (reasonField) {
      reasonField.value = strikethrough(escapeStrikethrough(reasonField.value))
    }

    const author = embeds[0]?.data.author
    if (author) {
      author.name = `[Revoked] ${author.name}`
      embeds[0]?.setAuthor(author)
    }

    await channel.messages.edit(log.messageId, { embeds })
    await channel.send({
      ...content,
      reply: { messageReference: log.messageId },
    })
  }
}

async function attachments(
  client: Client<true>,
  data: Extract<AmpqMessage, { type: "attachments" }>,
) {
  const { id, attachments } = data

  const logs = await Drizzle.select()
    .from(actionLogsTable)
    .where(eq(actionLogsTable.actionId, id))
  for (const log of logs) {
    const channel = client.channels.cache.get(log.channelId)
    if (!channel?.isTextBased()) {
      continue
    }

    const message = await channel.messages.fetch(log.messageId)
    if (message.author.id !== client.user.id) {
      continue
    }

    const attachmentsCopy = [...attachments]

    const logEmbeds = message.embeds.map(
      (embed) => new EmbedBuilder(embed.data),
    )
    logEmbeds[0]?.setURL(Config.url.external)
    if (!logEmbeds[0]?.data.image) {
      logEmbeds[0]?.setImage(attachmentsCopy[0] ?? null)
      attachmentsCopy.shift()
    }

    logEmbeds.push(
      ...attachmentsCopy.map((url) =>
        new EmbedBuilder().setImage(url).setURL(Config.url.external),
      ),
    )
    await message.edit({ embeds: logEmbeds })
  }
}

export type AmpqMessage =
  | {
      type: "create"
      id?: number
      guild: {
        id: string
        name: string
      }
      target: string
      content: MessageCreateOptions
    }
  | {
      type: "revoked"
      id: number
      content: MessageCreateOptions
    }
  | {
      type: "attachments"
      id: number
      attachments: string[]
    }
