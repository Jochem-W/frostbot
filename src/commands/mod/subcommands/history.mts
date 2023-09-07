import { modHistory } from "../../../messages/modHistory.mjs"
import { subcommand, slashOption } from "../../../models/slashCommand.mjs"
import { SlashCommandUserOption } from "discord.js"

export const HistorySubcommand = subcommand({
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

    const [firstReply, ...replies] = await modHistory(user, interaction.guild)
    if (!firstReply) {
      return
    }

    await interaction.reply(firstReply)
    for (const reply of replies) {
      await interaction.followUp(reply)
    }
  },
})
