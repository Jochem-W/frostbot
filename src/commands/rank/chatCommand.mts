import { slashCommand, slashOption } from "../../models/slashCommand.mjs"
import { sendRankCard } from "./logic.mjs"
import { SlashCommandUserOption } from "discord.js"

export const RankCommand = slashCommand({
  name: "rank",
  description: "View your own rank card, or that of another user.",
  defaultMemberPermissions: null,
  dmPermission: true,
  options: [
    slashOption(
      false,
      new SlashCommandUserOption()
        .setName("user")
        .setDescription("Target user"),
    ),
  ],
  async handle(interaction, user) {
    if (!user) {
      user = interaction.user
    }

    await sendRankCard(interaction, user, false)
  },
})
