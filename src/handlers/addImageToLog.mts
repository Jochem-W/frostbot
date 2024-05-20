/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { Drizzle } from "../clients.mjs"
import { Config } from "../models/config.mjs"
import { handler } from "../models/handler.mjs"
import { actionLogsTable, attachmentsTable } from "../schema.mjs"
import { attachmentsAreImages, fetchChannel } from "../util/discord.mjs"
import { fileURL, uploadAttachments } from "../util/s3.mjs"
import { ChannelType, EmbedBuilder } from "discord.js"
import { eq } from "drizzle-orm"

export const AddImageToLog = handler({
  event: "messageCreate",
  once: false,
  async handle(message) {
    if (!message.reference?.messageId || message.content) {
      return
    }

    const newAttachments = [...message.attachments.values()]
    if (!attachmentsAreImages(newAttachments) || newAttachments.length === 0) {
      return
    }

    const data = await Drizzle.select()
      .from(actionLogsTable)
      .where(eq(actionLogsTable.messageId, message.reference.messageId))
      .leftJoin(
        attachmentsTable,
        eq(attachmentsTable.actionId, actionLogsTable.actionId),
      )

    const log = data[0]?.actionLogs
    if (!log) {
      return
    }

    const oldAttachments = data
      .map((entry) => entry.attachments)
      .filter(
        (attachment): attachment is typeof attachmentsTable.$inferSelect =>
          attachment !== null,
      )
    if (oldAttachments.length + newAttachments.length > 4) {
      const reply = await message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Too many images")
            .setDescription(
              `Adding images failed, because the total number of images (${
                oldAttachments.length + newAttachments.length
              }) exceeds the limit (4).`,
            ),
        ],
      })

      await new Promise((resolve) => setTimeout(resolve, 3500))

      await reply.delete()
      return
    }

    const { fulfilled } = await uploadAttachments(newAttachments)

    await Drizzle.insert(attachmentsTable).values(
      fulfilled.map((result) => ({
        actionId: log.actionId,
        key: result.value.key,
      })),
    )

    const channel = await fetchChannel(
      message.client,
      log.channelId,
      ChannelType.GuildText,
    )

    const logMessage = await channel.messages.fetch(log.messageId)
    const mainEmbed = new EmbedBuilder(logMessage.embeds[0]?.data)

    await logMessage.edit({
      embeds: [
        ...logMessage.embeds.map((embed) =>
          new EmbedBuilder(embed.data).setURL(Config.url.external),
        ),
        ...fulfilled.map((attachment) =>
          new EmbedBuilder()
            .setURL(Config.url.external)
            .setColor(mainEmbed.data.color ?? null)
            .setImage(fileURL(attachment.value.key).toString()),
        ),
      ],
    })

    const reply = await message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Action updated")
          .setDescription(`Added ${fulfilled.length} images to the action`),
      ],
    })

    await message.delete()

    await new Promise((resolve) => setTimeout(resolve, 2500))

    await reply.delete()
  },
})
