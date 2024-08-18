/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { Exchange, ProducerChannel } from "../../../clients.mjs"
import { AmpqMessage } from "../../../handlers/rabbit.mjs"
import { modMenuLog } from "../../../messages/modMenuLog.mjs"
import { modMenuSuccess } from "../../../messages/modMenuSuccess.mjs"
import { staticComponent } from "../../../models/component.mjs"
import {
  modMenuState,
  getPermissions,
  tryAction,
  tryDm,
  tryInsert,
} from "../shared.mjs"
import { ComponentType } from "discord.js"

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

    const log = modMenuLog({ state, dmStatus, actionStatus, insertStatus })
    const ampqMessage: AmpqMessage = {
      type: "create",
      guild: {
        id: state.guild.id,
        name: state.guild.name,
      },
      target: state.target.id,
      content: {
        embeds: log.embeds.map((e) => e.toJSON()),
        components: log.components.map((c) => c.toJSON()),
      },
    }

    if (insertStatus.success) {
      ampqMessage.id = insertStatus.id
    }

    ProducerChannel.publish(
      Exchange,
      "",
      Buffer.from(JSON.stringify(ampqMessage)),
    )
  },
})
