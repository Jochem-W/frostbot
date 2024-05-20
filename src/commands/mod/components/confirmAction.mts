/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { Drizzle } from "../../../clients.mjs"
import { modMenuLog } from "../../../messages/modMenuLog.mjs"
import { modMenuSuccess } from "../../../messages/modMenuSuccess.mjs"
import { staticComponent } from "../../../models/component.mjs"
import { Config } from "../../../models/config.mjs"
import { actionLogsTable } from "../../../schema.mjs"
import { fetchChannel } from "../../../util/discord.mjs"
import {
  modMenuState,
  getPermissions,
  tryAction,
  tryDm,
  tryInsert,
} from "../shared.mjs"
import { ComponentType, ChannelType } from "discord.js"

export const confirmAction = staticComponent({
  type: ComponentType.Button,
  name: "mod-confirm",
  async handle(interaction) {
    if (!interaction.inCachedGuild()) {
      return
    }

    await interaction.deferUpdate()

    const state = await modMenuState(interaction)
    const { guild, target, action } = state

    const permissions = await getPermissions(guild, interaction.member, target)
    if (!permissions[action]) {
      await interaction.editReply(
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

    const insertStatus = await tryInsert({ state, dmStatus, actionStatus })

    await interaction.editReply(
      modMenuSuccess({
        state,
        dmStatus,
        actionStatus,
        insertStatus,
      }),
    )

    for (const channelId of Config.channels.mod) {
      const logs = await fetchChannel(
        interaction.client,
        channelId,
        ChannelType.GuildText,
      )

      if (
        state.guild.id !== logs.guild.id &&
        !logs.guild.members.cache.has(state.target.id)
      ) {
        continue
      }

      const message = await logs.send(
        modMenuLog({ state, dmStatus, actionStatus, insertStatus }),
      )
      if (insertStatus.success) {
        await Drizzle.insert(actionLogsTable).values({
          messageId: message.id,
          channelId,
          actionId: insertStatus.id,
        })
      }
    }
  },
})
