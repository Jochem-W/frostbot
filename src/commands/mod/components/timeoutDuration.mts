/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { modMenu } from "../../../messages/modMenu.mjs"
import { staticComponent } from "../../../models/component.mjs"
import { modMenuState } from "../shared.mjs"
import { ComponentType } from "discord.js"

export const timeoutDuration = staticComponent({
  type: ComponentType.StringSelect,
  name: "mod-timeout",
  async handle(interaction) {
    if (!interaction.inCachedGuild()) {
      return
    }

    const value = interaction.values[0]
    if (!value) {
      return
    }

    const duration = parseInt(value, 10)
    if (isNaN(duration)) {
      return
    }

    const state = await modMenuState(interaction)
    state.timeout = duration

    await interaction.update(await modMenu(state))
  },
})
