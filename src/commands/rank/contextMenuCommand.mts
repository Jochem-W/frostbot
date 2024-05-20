import {
  InteractionContext,
  InstallationContext,
} from "../../models/command.mjs"
import { contextMenuCommand } from "../../models/contextMenuCommand.mjs"
import { sendRankCard } from "./logic.mjs"
import { ApplicationCommandType } from "discord.js"

export const RankContextCommand = contextMenuCommand({
  type: ApplicationCommandType.User,
  name: "View rank",
  defaultMemberPermissions: null,
  contexts: [InteractionContext.Guild, InteractionContext.BotDm],
  integrationTypes: [InstallationContext.GuildInstall],
  async handle(interaction, user) {
    await sendRankCard(interaction, user, true)
  },
})
