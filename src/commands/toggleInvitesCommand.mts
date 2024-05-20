/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { InteractionContext, InstallationContext } from "../models/command.mjs"
import { slashCommand, slashSubcommand } from "../models/slashCommand.mjs"
import { PermissionFlagsBits } from "discord.js"

export const ToggleInvitesCommand = slashCommand({
  name: "toggle",
  description: "Command group",
  contexts: [InteractionContext.Guild],
  integrationTypes: [InstallationContext.GuildInstall],
  nsfw: false,
  defaultMemberPermissions: PermissionFlagsBits.Administrator,
  subcommands: [
    slashSubcommand({
      name: "invites",
      description: "Toggle whether invites are paused",
      async handle(interaction) {
        if (!interaction.inCachedGuild()) {
          return
        }

        await interaction.guild.disableInvites(
          !interaction.guild.features.includes("INVITES_DISABLED"),
        )
      },
    }),
  ],
})
