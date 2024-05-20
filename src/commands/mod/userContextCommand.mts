import { modMenu, type ModMenuState } from "../../messages/modMenu.mjs"
import {
  InstallationContext,
  InteractionContext,
} from "../../models/command.mjs"
import { contextMenuCommand } from "../../models/contextMenuCommand.mjs"
import { tryFetchMember } from "../../util/discord.mjs"
import { ApplicationCommandType, PermissionFlagsBits } from "discord.js"

export const ModUserContextCommand = contextMenuCommand({
  name: "Open mod menu",
  type: ApplicationCommandType.User,
  defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,
  contexts: [InteractionContext.Guild],
  integrationTypes: [InstallationContext.GuildInstall],
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

    const member = await tryFetchMember(guild, target)
    if (member) {
      state.target = member
    }

    await interaction.reply(await modMenu(state))
  },
})
