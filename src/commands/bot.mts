/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { Colours } from "../models/colours.mjs"
import { InstallationContext, InteractionContext } from "../models/command.mjs"
import { modal, modalInput } from "../models/modal.mjs"
import { slashCommand, slashSubcommand } from "../models/slashCommand.mjs"
import {
  EmbedBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js"

export const BotCommand = slashCommand({
  name: "bot",
  description: "Commands related to the bot user",
  defaultMemberPermissions: PermissionFlagsBits.Administrator,
  contexts: [InteractionContext.Guild],
  integrationTypes: [InstallationContext.GuildInstall],
  nsfw: false,
  subcommands: [
    slashSubcommand({
      name: "edit",
      description: "Edit the bot's name and description",
      async handle(interaction) {
        await interaction.showModal(
          editModal({
            username: interaction.client.user.username,
            description: interaction.client.application.description ?? "",
          }),
        )
      },
    }),
    slashSubcommand({
      name: "avatar",
      description: "Change the bot's avatar",
      options: [
        {
          name: "image",
          description: "The image to change the avatar to",
          required: true,
          type: "attachment",
        },
      ],
      async handle(interaction, image) {
        if (!image.contentType?.startsWith("image/")) {
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle("Invalid image")
                .setDescription(
                  `The file ${image.name} appears to be an invalid image.`,
                )
                .setColor(Colours.red[500]),
            ],
            ephemeral: true,
          })

          return
        }

        await interaction.deferReply({ ephemeral: true })

        const response = await fetch(image.url)
        if (!response.ok || !response.body) {
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setTitle("Download failed")
                .setDescription("Failed to download the image from Discord.")
                .setColor(Colours.red[500]),
            ],
          })

          return
        }

        const arrayBuffer = await response.arrayBuffer()
        await interaction.client.user.edit({ avatar: Buffer.from(arrayBuffer) })

        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle("Bot profile updated")
              .setAuthor({
                name: interaction.client.user.displayName,
                iconURL: interaction.client.user.displayAvatarURL(),
              })
              .setDescription(interaction.client.application.description),
          ],
        })
      },
    }),
  ],
})

const editModal = modal({
  id: "bot-edit",
  title: "Edit bot profile",
  components: [
    modalInput(
      "username",
      true,
      new TextInputBuilder()
        .setLabel("Name")
        .setMaxLength(32)
        .setMinLength(2)
        .setStyle(TextInputStyle.Short),
    ),
    modalInput(
      "description",
      false,
      new TextInputBuilder()
        .setLabel("Description")
        .setMaxLength(400)
        .setStyle(TextInputStyle.Paragraph),
    ),
  ],
  async handle(interaction, { username, description }) {
    await interaction.client.application.edit({
      description: description ?? "",
    })
    await interaction.client.user.edit({ username })
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Bot profile updated")
          .setAuthor({
            name: interaction.client.user.displayName,
            iconURL: interaction.client.user.displayAvatarURL(),
          })
          .setDescription(interaction.client.application.description),
      ],
      ephemeral: true,
    })
  },
})
