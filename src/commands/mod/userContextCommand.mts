import {
  getPermissions,
  modMenu,
  type ModMenuState,
} from "../../messages/modMenu.mjs"
import { contextMenuCommand } from "../../models/contextMenuCommand.mjs"
import { tryFetchMember } from "../../util/discord.mjs"
import { ApplicationCommandType, PermissionFlagsBits } from "discord.js"

export const ModUserContextCommand = contextMenuCommand({
  name: "Open mod menu",
  type: ApplicationCommandType.User,
  defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,
  dmPermission: false,
  async handle(interaction, targetUser) {
    if (!interaction.inCachedGuild()) {
      return
    }

    const { guild } = interaction

    const state: ModMenuState = {
      guild,
      targetUser,
      dm: false,
      staffMember: interaction.member,
      action: "restrain",
      permissions: await getPermissions(guild, targetUser),
      timestamp: interaction.createdAt,
    }

    const member = await tryFetchMember(guild, targetUser)
    if (member) {
      state.targetMember = member
      state.permissions = await getPermissions(guild, targetUser, member)
    }

    await interaction.reply(await modMenu(state))
  },
})
