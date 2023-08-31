import { modHistory } from "../../messages/modHistory.mjs"
import {
  getPermissions,
  modMenu,
  type ModMenuState,
} from "../../messages/modMenu.mjs"
import {
  slashCommand,
  slashOption,
  subcommand,
} from "../../models/slashCommand.mjs"
import { tryFetchMember } from "../../util/discord.mjs"
import { PermissionFlagsBits, SlashCommandUserOption } from "discord.js"

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

        const targetMember = await tryFetchMember(guild, targetUser)
        if (targetMember) {
          state.targetMember = targetMember
          state.permissions = await getPermissions(
            guild,
            targetUser,
            targetMember,
          )
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
  ],
})
