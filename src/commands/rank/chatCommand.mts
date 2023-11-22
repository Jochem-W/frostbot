import { slashCommand } from "../../models/slashCommand.mjs"
import { sendRankCard } from "./logic.mjs"

export const RankCommand = slashCommand({
  name: "rank",
  description: "View your own rank card, or that of another user.",
  defaultMemberPermissions: null,
  dmPermission: true,
  nsfw: false,
  options: [
    {
      name: "user",
      description: "Target user",
      type: "user",
      required: false,
    },
  ],
  async handle(interaction, user) {
    if (!user) {
      user = interaction.user
    }

    await sendRankCard(interaction, user, false)
  },
})
