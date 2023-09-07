import { Drizzle } from "../../../clients.mjs"
import { ModMenuState } from "../../../messages/modMenu.mjs"
import { modMenuLog } from "../../../messages/modMenuLog.mjs"
import { modMenuSuccess } from "../../../messages/modMenuSuccess.mjs"
import { Config } from "../../../models/config.mjs"
import { slashOption, subcommand } from "../../../models/slashCommand.mjs"
import { actionLogsTable, insertActionsSchema } from "../../../schema.mjs"
import { fetchChannel, tryFetchMember } from "../../../util/discord.mjs"
import { getPermissions, tryAction, tryDm, tryInsert } from "../shared.mjs"
import {
  ChannelType,
  SlashCommandBooleanOption,
  SlashCommandStringOption,
  SlashCommandUserOption,
} from "discord.js"
import { Duration } from "luxon"
import { z } from "zod"

export const ActSubcommand = subcommand({
  name: "act",
  description: "Perform a moderation action without using the moderation menu",
  options: [
    slashOption(
      true,
      new SlashCommandUserOption()
        .setName("target")
        .setDescription("Target user"),
    ),
    slashOption(
      true,
      new SlashCommandStringOption()
        .setName("action")
        .setDescription("The action to undertake")
        .setChoices(
          { name: "Note", value: "note" },
          { name: "Warn", value: "warn" },
          {
            name: "Timeout (1 day)",
            value: `timeout:${Duration.fromObject({ days: 1 }).toMillis()}`,
          },
          {
            name: "Timeout (1 week)",
            value: `timeout:${Duration.fromObject({ weeks: 1 }).toMillis()}`,
          },
          { name: "Kick", value: "kick" },
          { name: "Ban (keep messages)", value: "ban:0" },
          {
            name: "Ban (delete messages)",
            value: `ban:${Duration.fromObject({ days: 7 }).as("seconds")}`,
          },
        ),
    ),
    slashOption(
      true,
      new SlashCommandStringOption()
        .setName("body")
        .setDescription("The reason/note body"),
    ),
    slashOption(
      true,
      new SlashCommandBooleanOption()
        .setName("dm")
        .setDescription(
          "Send a DM to the user, always false for note, always true for warn",
        ),
    ),
  ],
  async handle(interaction, targetUser, rawAction, body, dm) {
    if (!interaction.inCachedGuild()) {
      return
    }

    const [actionName, actionExtra] = rawAction.split(":")
    const action = await insertActionsSchema.shape.action.parseAsync(actionName)
    const targetMember = await tryFetchMember(interaction.guild, targetUser)

    const state: ModMenuState = {
      guild: interaction.guild,
      target: targetMember ?? targetUser,
      action,
      body,
      dm,
      staff: interaction.member,
      timestamp: interaction.createdAt,
    }

    switch (action) {
      case "timeout":
        state.timeout = await z.coerce.number().parseAsync(actionExtra)
        break
      case "ban":
        state.deleteMessageSeconds = await z.coerce
          .number()
          .parseAsync(actionExtra)
        break
      case "note":
        state.dm = false
        break
      case "warn":
        state.dm = true
        break
    }

    // TODO: move this check to tryAction
    const permissions = await getPermissions(
      state.guild,
      interaction.member,
      state.target,
    )
    if (!permissions[action]) {
      await interaction.reply(
        modMenuSuccess({
          state,
        }),
      )
      return
    }

    let dmStatus
    let actionStatus
    if (action === "ban" || action === "kick") {
      dmStatus = await tryDm(state)
      actionStatus = await tryAction(state)
    } else {
      actionStatus = await tryAction(state)
      if (actionStatus.success) {
        dmStatus = await tryDm(state)
      } else {
        dmStatus = { success: false, error: "action_failed" as const }
      }
    }

    const insertStatus = await tryInsert({ state, actionStatus, dmStatus })

    await interaction.reply(
      modMenuSuccess({
        state,
        dmStatus,
        actionStatus,
        insertStatus,
      }),
    )

    const channel = await fetchChannel(
      interaction.client,
      Config.channels.mod,
      ChannelType.GuildText,
    )

    const message = await channel.send(
      modMenuLog({ state, dmStatus, actionStatus, insertStatus }),
    )
    if (insertStatus.success) {
      await Drizzle.insert(actionLogsTable).values({
        messageId: message.id,
        channelId: message.channelId,
        actionId: insertStatus.id,
      })
    }
  },
})
