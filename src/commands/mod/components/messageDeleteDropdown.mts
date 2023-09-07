import { modMenu } from "../../../messages/modMenu.mjs"
import { staticComponent } from "../../../models/component.mjs"
import { modMenuState } from "../shared.mjs"
import { ComponentType } from "discord.js"

export const messageDeleteDropdown = staticComponent({
  type: ComponentType.StringSelect,
  name: "mod-delete",
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
    state.deleteMessageSeconds = duration

    await interaction.update(await modMenu(state))
  },
})
