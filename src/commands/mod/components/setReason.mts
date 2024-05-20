/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { staticComponent } from "../../../models/component.mjs"
import { setReasonModal, setBodyModal } from "../modals.mjs"
import { modMenuState } from "../shared.mjs"
import { ComponentType } from "discord.js"

export const setReason = staticComponent({
  type: ComponentType.Button,
  name: "mod-body",
  async handle(interaction) {
    if (!interaction.inCachedGuild()) {
      return
    }

    const state = await modMenuState(interaction)

    const defaults: Parameters<typeof setReasonModal>[0] = {}
    if (state.body) {
      defaults.body = state.body
    }

    if (state.action === "note") {
      await interaction.showModal(setBodyModal(defaults))
      return
    }

    await interaction.showModal(setReasonModal(defaults))
  },
})
