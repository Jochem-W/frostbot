import { modHistory } from "../../../messages/modHistory.mjs"
import { slashSubcommand } from "../../../models/slashCommand.mjs"

export const HistorySubcommand = slashSubcommand({
  name: "history",
  description: "Retrieve the moderation history for a user",
  options: [
    { name: "user", description: "Target user", type: "user", required: true },
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
