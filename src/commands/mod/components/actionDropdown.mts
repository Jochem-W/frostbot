/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { modMenu } from "../../../messages/modMenu.mjs"
import { staticComponent } from "../../../models/component.mjs"
import { insertActionsSchema } from "../../../schema.mjs"
import { modMenuState } from "../shared.mjs"
import { ComponentType } from "discord.js"

export const actionDropdown = staticComponent({
  type: ComponentType.StringSelect,
  name: "mod-action",
  async handle(interaction) {
    if (!interaction.inCachedGuild()) {
      return
    }

    const value = interaction.values[0]
    if (!value) {
      return
    }

    const state = await modMenuState(interaction)
    state.action = await insertActionsSchema.shape.action.parseAsync(value)

    switch (value) {
      case "note":
      case "restrain":
      case "unban":
        state.dm = false
        break
      default:
        state.dm = true
        break
    }

    await interaction.update(await modMenu(state))
  },
})
