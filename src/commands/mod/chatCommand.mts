import { Drizzle } from "../../clients.mjs"
import { modHistory } from "../../messages/modHistory.mjs"
import { modMenu, type ModMenuState } from "../../messages/modMenu.mjs"
import { Colours } from "../../models/colours.mjs"
import { Config } from "../../models/config.mjs"
import {
  slashCommand,
  slashOption,
  subcommand,
} from "../../models/slashCommand.mjs"
import {
  actionLogsTable,
  actionsTable,
  attachmentsTable,
} from "../../schema.mjs"
import { tryFetchMember } from "../../util/discord.mjs"
import { uploadAttachment } from "../../util/s3.mjs"
import {
  Attachment,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandAttachmentOption,
  SlashCommandIntegerOption,
  SlashCommandUserOption,
} from "discord.js"
import { eq, sql } from "drizzle-orm"
import { MIMEType } from "util"

function attachmentsAreImages(
  attachments: Attachment[],
): attachments is (Attachment & { contentType: `image/${string}` })[] {
  return !attachments.find(
    (attachment) =>
      !attachment.contentType ||
      new MIMEType(attachment.contentType).type !== "image",
  )
}

export const ModCommand = slashCommand({
  name: "mod",
  description: "Commands related to moderation",
  defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,
  dmPermission: false,
  subcommands: [
    subcommand({
      name: "menu",
      description: "Open the moderation menu for a user",
      options: [
        slashOption(
          true,
          new SlashCommandUserOption()
            .setName("user")
            .setDescription("Target user"),
        ),
      ],
      async handle(interaction, target) {
        if (!interaction.inCachedGuild()) {
          return
        }

        const { guild } = interaction

        const state: ModMenuState = {
          guild,
          target,
          dm: false,
          staff: interaction.member,
          action: "restrain",
          timestamp: interaction.createdAt,
          deleteMessageSeconds: 0,
        }

        const targetMember = await tryFetchMember(guild, target)
        if (targetMember) {
          state.target = targetMember
        }

        await interaction.reply(await modMenu(state))
      },
    }),
    subcommand({
      name: "history",
      description: "Retrieve the moderation history for a user",
      options: [
        slashOption(
          true,
          new SlashCommandUserOption()
            .setName("user")
            .setDescription("Target user"),
        ),
      ],
      async handle(interaction, user) {
        if (!interaction.inCachedGuild()) {
          return
        }

        const [firstReply, ...replies] = await modHistory(
          user,
          interaction.guild,
        )
        if (!firstReply) {
          return
        }

        await interaction.reply(firstReply)
        for (const reply of replies) {
          await interaction.followUp(reply)
        }
      },
    }),
    subcommand({
      name: "attach",
      description: "Attach images to a log",
      options: [
        slashOption(
          true,
          new SlashCommandIntegerOption()
            .setName("id")
            .setDescription("Action log ID"),
        ),
        slashOption(
          true,
          new SlashCommandAttachmentOption()
            .setName("image")
            .setDescription("Image to attach"),
        ),
        slashOption(
          false,
          new SlashCommandAttachmentOption()
            .setName("image2")
            .setDescription("Image to attach"),
        ),
        slashOption(
          false,
          new SlashCommandAttachmentOption()
            .setName("image3")
            .setDescription("Image to attach"),
        ),
        slashOption(
          false,
          new SlashCommandAttachmentOption()
            .setName("image4")
            .setDescription("Image to attach"),
        ),
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

        const results = await Promise.allSettled(filtered.map(uploadAttachment))

        const rejected = []
        const fulfilled = []
        for (const result of results) {
          switch (result.status) {
            case "fulfilled":
              fulfilled.push(result)
              break
            case "rejected":
              rejected.push(result)
              break
          }
        }

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

        const [action] = await Drizzle.select({
          data: actionsTable,
          log: actionLogsTable,
        })
          .from(actionsTable)
          .where(eq(actionsTable.id, id))
          .innerJoin(
            actionLogsTable,
            eq(actionLogsTable.actionId, actionsTable.id),
          )

        if (!action) {
          return
        }

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
      },
    }),
  ],
})
