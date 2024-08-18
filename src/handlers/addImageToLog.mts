/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { Drizzle, Exchange, ProducerChannel } from "../clients.mjs"
import { handler } from "../models/handler.mjs"
import { actionLogsTable, attachmentsTable } from "../schema.mjs"
import { attachmentsAreImages } from "../util/discord.mjs"
import { uploadAttachments } from "../util/s3.mjs"
import { AmpqMessage } from "./rabbit.mjs"
import { EmbedBuilder } from "discord.js"
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

    const actionLog = data[0]?.action_logs
    if (!actionLog) {
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
        actionId: actionLog.actionId,
        key: result.value.key,
      })),
    )

    const reply = await message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Action updated")
          .setDescription(`Added ${fulfilled.length} images to the action`),
      ],
    })

    await message.delete()

    const delay = new Promise((resolve) => setTimeout(resolve, 2500))

    const amqpMessage: AmpqMessage = {
      type: "attachments",
      id: actionLog.actionId,
      attachments: fulfilled.map((f) => f.value.url.toString()),
    }

    ProducerChannel.publish(
      Exchange,
      "",
      Buffer.from(JSON.stringify(amqpMessage)),
    )

    await delay

    await reply.delete()
  },
})
