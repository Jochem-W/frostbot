import { Drizzle } from "../../../clients.mjs"
import { Colours } from "../../../models/colours.mjs"
import { slashSubcommand } from "../../../models/slashCommand.mjs"
import { actionLogsTable, actionsTable } from "../../../schema.mjs"
import { fetchChannel } from "../../../util/discord.mjs"
import { formatTitle } from "../shared.mjs"
import {
  ChannelType,
  EmbedBuilder,
  escapeStrikethrough,
  strikethrough,
} from "discord.js"
import { and, eq, sql } from "drizzle-orm"

export const RevokeSubcommand = slashSubcommand({
  name: "revoke",
  description: "Revoke a logged action",
  options: [
    {
      name: "id",
      description: "The action ID",
      type: "integer",
      required: true,
      async autocomplete(interaction, value) {
        const matches = await Drizzle.select({
          id: actionsTable.id,
          action: actionsTable.action,
          userId: actionsTable.userId,
          staffId: actionsTable.staffId,
          body: actionsTable.body,
        })
          .from(actionsTable)
          .where(
            and(
              sql`${actionsTable.id}::TEXT LIKE ${`%${value}%`}`,
              eq(actionsTable.revoked, false),
            ),
          )
          .limit(25)

        return matches.map((action) => {
          let name = `${action.id}: ${formatTitle(
            interaction.client.users.cache.get(action.staffId) ??
              action.staffId,
            interaction.client.users.cache.get(action.userId) ?? action.userId,
            action.action,
          )}`

          if (action.body) {
            if (name.length + action.body.length + 3 <= 100) {
              name = `${name} (${action.body})`
            } else if (name.length + 5 < 100) {
              name = `${name} (${action.body.slice(0, 100 - name.length - 4)}…)`
            }
          }

          return {
            name,
            value: action.id,
          }
        })
      },
    },
  ],
  async handle(interaction, id) {
    await interaction.deferReply({ ephemeral: true })

    const [action] = await Drizzle.update(actionsTable)
      .set({ revoked: true })
      .where(eq(actionsTable.id, id))
      .returning({ body: actionsTable.body })

    const logs = await Drizzle.select()
      .from(actionLogsTable)
      .where(eq(actionLogsTable.actionId, id))
    for (const log of logs) {
      const channel = await fetchChannel(
        interaction.client,
        log.channelId,
        ChannelType.GuildText,
      )
      const message = await channel.messages.fetch(log.messageId)
      const embeds = message.embeds.map((embed) => new EmbedBuilder(embed.data))
      const description = embeds[0]?.data.description
      if (description) {
        embeds[0]?.setDescription(
          strikethrough(escapeStrikethrough(description)),
        )
      }

      const author = embeds[0]?.data.author
      if (author) {
        author.name = `[Revoked] ${author.name}`
        embeds[0]?.setAuthor(author)
      }

      await channel.messages.edit(log.messageId, { embeds })
    }

    const embed = new EmbedBuilder()
      .setTitle(`Revoked action ${id}`)
      .setColor(Colours.green[500])

    if (action?.body) {
      embed.setDescription(strikethrough(escapeStrikethrough(action.body)))
    }

    await interaction.editReply({
      embeds: [embed],
    })
  },
})
