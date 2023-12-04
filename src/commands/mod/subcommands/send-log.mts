import { Drizzle } from "../../../clients.mjs"
import { modMenuLogFromDb } from "../../../messages/modMenuLog.mjs"
import { Config } from "../../../models/config.mjs"
import { slashSubcommand } from "../../../models/slashCommand.mjs"
import { actionsTable } from "../../../schema.mjs"
import { actionWithImages } from "../../../util/db.mjs"
import { fetchChannel } from "../../../util/discord.mjs"
import { formatTitle } from "../shared.mjs"
import { ChannelType } from "discord.js"
import { and, sql, eq } from "drizzle-orm"

export const SendLogSubcommand = slashSubcommand({
  name: "send-log",
  description: "Send a moderation log in the logs channel",
  options: [
    {
      name: "id",
      description: "Action log ID",
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
  ],
  async handle(interaction, id) {
    if (!interaction.inCachedGuild()) {
      return
    }

    const action = await actionWithImages(eq(actionsTable.id, id))
    if (!action) {
      return
    }

    const response = await interaction.deferReply({ ephemeral: true })

    const channel = await fetchChannel(
      interaction.client,
      Config.channels.mod,
      ChannelType.GuildText,
    )
    await channel.send(await modMenuLogFromDb(interaction.client, action))

    await response.delete()
  },
})
