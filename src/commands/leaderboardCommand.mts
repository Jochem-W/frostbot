import { Colours } from "../models/colours.mjs"
import { Config } from "../models/config.mjs"
import { slashCommand } from "../models/slashCommand.mjs"
import { EmbedBuilder, hyperlink } from "discord.js"

export const LeaderboardCommand = slashCommand({
  name: "leaderboard",
  description: "View the leaderboard",
  defaultMemberPermissions: null,
  dmPermission: true,
  async handle(interaction) {
    let { guild } = interaction
    if (!guild) {
      guild = await interaction.client.guilds.fetch(Config.guild)
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`${guild.name} leaderboard`)
          .setDescription(
            `The online leaderboard can be viewed ${hyperlink(
              "here",
              Config.baseUrl,
            )}!`,
          )
          .setColor(Colours.blue[500]),
      ],
    })
  },
})
