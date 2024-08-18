/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { Drizzle, Exchange, ProducerChannel } from "../../../clients.mjs"
import { AmpqMessage } from "../../../handlers/rabbit.mjs"
import { Colours } from "../../../models/colours.mjs"
import { slashSubcommand } from "../../../models/slashCommand.mjs"
import { actionsTable } from "../../../schema.mjs"
import { formatTitle } from "../shared.mjs"
import { EmbedBuilder, escapeStrikethrough, strikethrough } from "discord.js"
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
    },
  ],
  async handle(interaction, id, hide) {
    await interaction.deferReply({ ephemeral: true })

    const [action] = await Drizzle.update(actionsTable)
      .set({ revoked: true, hidden: hide ?? false })
      .where(eq(actionsTable.id, id))
      .returning({
        body: actionsTable.body,
        userId: actionsTable.userId,
        id: actionsTable.id,
      })

    if (!action) {
      throw new Error(`Invalid action ${id}`)
    }

    const amqpMessage: AmpqMessage = {
      type: "revoked",
      content: {
        embeds: [
          new EmbedBuilder()
            .setAuthor({
              name: `Action revoked${hide ? " and hidden" : ""} by ${
                interaction.user.displayName
              }`,
              iconURL: interaction.user.displayAvatarURL(),
            })
            .setColor(Colours.red[500])
            .setTimestamp(interaction.createdAt),
        ],
      },
      id: action.id,
    }

    ProducerChannel.publish(
      Exchange,
      "",
      Buffer.from(JSON.stringify(amqpMessage)),
    )

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
