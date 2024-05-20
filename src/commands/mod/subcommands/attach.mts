/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { Drizzle } from "../../../clients.mjs"
import { Colours } from "../../../models/colours.mjs"
import { Config } from "../../../models/config.mjs"
import { slashSubcommand } from "../../../models/slashCommand.mjs"
import {
  attachmentsTable,
  actionsTable,
  actionLogsTable,
} from "../../../schema.mjs"
import { attachmentsAreImages } from "../../../util/discord.mjs"
import { uploadAttachments } from "../../../util/s3.mjs"
import { formatTitle } from "../shared.mjs"
import { Attachment, EmbedBuilder } from "discord.js"
import { sql, eq, and } from "drizzle-orm"

export const AttachSubcommand = slashSubcommand({
  name: "attach",
  description: "Attach images to a log",
  options: [
    {
      name: "id",
      description: "Action log ID",
      type: "integer",
      required: true,
      async autocomplete(interaction, value) {
        const matches = await Drizzle.select({
          id: actionsTable.id,
          action: actionsTable.action,
          userId: actionsTable.userId,
          staffId: actionsTable.staffId,
          body: actionsTable.body,
        })
          .from(actionsTable)
          .where(
            and(
              sql`${actionsTable.id}::TEXT LIKE ${`%${value}%`}`,
              eq(actionsTable.revoked, false),
              eq(actionsTable.hidden, false),
            ),
          )
          .limit(25)

        return matches.map((action) => {
          let name = `${action.id}: ${formatTitle(
            interaction.client.users.cache.get(action.staffId) ??
              action.staffId,
            interaction.client.users.cache.get(action.userId) ?? action.userId,
            action.action,
          )}`

          if (action.body) {
            if (name.length + action.body.length + 3 <= 100) {
              name = `${name} (${action.body})`
            } else if (name.length + 5 < 100) {
              name = `${name} (${action.body.slice(0, 100 - name.length - 4)}…)`
            }
          }

          return {
            name,
            value: action.id,
          }
        })
      },
    },
    {
      name: "image1",
      description: "Image to attach",
      type: "attachment",
      required: true,
    },
    {
      name: "image2",
      description: "Image to attach",
      type: "attachment",
      required: true,
    },
    {
      name: "image3",
      description: "Image to attach",
      type: "attachment",
      required: true,
    },
    {
      name: "image4",
      description: "Image to attach",
      type: "attachment",
      required: true,
    },
  ],
  async handle(interaction, id, ...attachments) {
    const filtered = attachments.filter(
      (image): image is Attachment => image !== null,
    )

    if (!attachmentsAreImages(filtered)) {
      await interaction.reply({
        ephemeral: true,
        embeds: [
          new EmbedBuilder()
            .setAuthor({ name: "Invalid attachments" })
            .setDescription(
              "One or more of the supplied attachments isn't a valid image.",
            )
            .setColor(Colours.red[500]),
        ],
      })
      return
    }

    const [attachmentCount] = await Drizzle.select({
      count: sql<string>`count(*)`,
    })
      .from(attachmentsTable)
      .where(eq(attachmentsTable.actionId, id))

    if (
      attachmentCount &&
      BigInt(attachmentCount.count) + BigInt(filtered.length) > 4
    ) {
      await interaction.reply({
        ephemeral: true,
        embeds: [
          new EmbedBuilder()
            .setAuthor({ name: "Too many attachments" })
            .setDescription(
              `It's not possible to attach more than 4 images to a log, and you're trying to attach ${filtered.length} images to a log that already has ${attachmentCount.count} images.`,
            )
            .setColor(Colours.red[500]),
        ],
      })
      return
    }

    await interaction.deferReply({ ephemeral: true })

    const { fulfilled, rejected } = await uploadAttachments(filtered)

    await Drizzle.insert(attachmentsTable).values(
      fulfilled.map((result) => ({ actionId: id, key: result.value.key })),
    )

    const embeds = fulfilled.map((result) =>
      new EmbedBuilder()
        .setImage(result.value.url.toString())
        .setURL(Config.url.external),
    )

    let firstEmbed = embeds[0]
      ?.setAuthor({ name: "Attachments added" })
      .setColor(Colours.blue[500])
    if (!firstEmbed) {
      firstEmbed = new EmbedBuilder()
        .setAuthor({
          name: "No attachments added",
        })
        .setColor(Colours.red[500])
      embeds.push(firstEmbed)
    }

    firstEmbed.setDescription(
      rejected
        .map(
          (result) =>
            `- Adding an attachment failed: ${JSON.stringify(
              result.reason,
            ).replace("\n", " ")}`,
        )
        .join("\n") || null,
    )

    await interaction.editReply({ embeds })

    const actions = await Drizzle.select({
      data: actionsTable,
      log: actionLogsTable,
    })
      .from(actionsTable)
      .where(eq(actionsTable.id, id))
      .innerJoin(actionLogsTable, eq(actionLogsTable.actionId, actionsTable.id))

    for (const action of actions) {
      const channel = await interaction.client.channels.fetch(
        action.log.channelId,
      )
      if (!channel?.isTextBased()) {
        return
      }

      const message = await channel.messages.fetch(action.log.messageId)
      const logEmbeds = message.embeds.map(
        (embed) => new EmbedBuilder(embed.data),
      )
      logEmbeds[0]?.setURL(Config.url.external)
      if (!logEmbeds[0]?.data.image) {
        logEmbeds[0]?.setImage(fulfilled[0]?.value.url.toString() ?? null)
        fulfilled.shift()
      }

      logEmbeds.push(
        ...fulfilled.map((result) =>
          new EmbedBuilder()
            .setImage(result.value.url.toString())
            .setURL(Config.url.external),
        ),
      )
      await message.edit({ embeds: logEmbeds })
    }
  },
})
