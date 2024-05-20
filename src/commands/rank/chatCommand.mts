/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import {
  InteractionContext,
  InstallationContext,
} from "../../models/command.mjs"
import { slashCommand } from "../../models/slashCommand.mjs"
import { sendRankCard } from "./logic.mjs"

export const RankCommand = slashCommand({
  name: "rank",
  description: "View your own rank card, or that of another user.",
  defaultMemberPermissions: null,
  contexts: [InteractionContext.Guild, InteractionContext.BotDm],
  integrationTypes: [InstallationContext.GuildInstall],
  nsfw: false,
  options: [
    {
      name: "user",
      description: "Target user",
      type: "user",
    },
  ],
  async handle(interaction, user) {
    if (!user) {
      user = interaction.user
    }

    await sendRankCard(interaction, user, false)
  },
})
