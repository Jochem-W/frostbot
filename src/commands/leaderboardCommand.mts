import { Colours } from "../models/colours.mjs"
import { InteractionContext, InstallationContext } from "../models/command.mjs"
import { Config } from "../models/config.mjs"
import { slashCommand } from "../models/slashCommand.mjs"
import { EmbedBuilder, hyperlink } from "discord.js"

export const LeaderboardCommand = slashCommand({
  name: "leaderboard",
  description: "View the leaderboard",
  defaultMemberPermissions: null,
  contexts: [InteractionContext.Guild, InteractionContext.BotDm],
  integrationTypes: [InstallationContext.GuildInstall],
  nsfw: false,
  async handle(interaction) {
    let { guild } = interaction
    if (!guild) {
      guild = await interaction.client.guilds.fetch(Config.guild)
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Leaderboard")
          .setDescription(
            `The online leaderboard can be viewed ${hyperlink(
              "here",
              Config.url.external,
            )}!`,
          )
          .setColor(Colours.blue[500]),
      ],
    })
  },
})
