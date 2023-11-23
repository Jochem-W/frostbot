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
              eq(actionsTable.hidden, false),
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
    {
      name: "hide",
      description: "Completely hide the action log (not recommended)",
      type: "boolean",
      required: false,
    },
  ],
  async handle(interaction, id, hide) {
    await interaction.deferReply({ ephemeral: true })

    const [action] = await Drizzle.update(actionsTable)
      .set({ revoked: true, hidden: hide ?? false })
      .where(eq(actionsTable.id, id))
      .returning({ body: actionsTable.body, userId: actionsTable.userId })

    if (!action) {
      throw new Error(`Invalid action ${id}`)
    }

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
      const reasonField = embeds[0]?.data.fields?.find(
        (field) => field.name === "❔ Reason" || field.name === "🗒️ Body",
      )
      if (reasonField) {
        reasonField.value = strikethrough(
          escapeStrikethrough(reasonField.value),
        )
      }

      const author = embeds[0]?.data.author
      if (author) {
        author.name = `[Revoked] ${author.name}`
        embeds[0]?.setAuthor(author)
      }

      await channel.messages.edit(log.messageId, { embeds })
      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setAuthor({
              name: `Action revoked${hide ? " and hidden" : ""} by ${
                interaction.user.displayName
              }`,
              iconURL: interaction.user.displayAvatarURL(),
            })
            .setColor(Colours.red[500]),
        ],
        reply: {
          messageReference: log.messageId,
        },
      })
    }

    const targetUser = await interaction.client.users.fetch(action.userId)

    const embed = new EmbedBuilder()
      .setTitle(`Revoked action ${id} against ${targetUser.displayName}`)
      .setColor(Colours.green[500])

    if (action?.body) {
      embed.setDescription(strikethrough(escapeStrikethrough(action.body)))
    }

    await interaction.editReply({
      embeds: [embed],
    })
  },
})
