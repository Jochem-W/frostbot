import { ModMenuState, modMenu } from "../../../messages/modMenu.mjs"
import { slashSubcommand } from "../../../models/slashCommand.mjs"
import { tryFetchMember } from "../../../util/discord.mjs"

export const MenuSubcommand = slashSubcommand({
  name: "menu",
  description: "Open the moderation menu for a user",
  options: [
    { name: "user", description: "Target user", type: "user", required: true },
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
})
