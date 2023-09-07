import { modMenu } from "../../../messages/modMenu.mjs"
import { staticComponent } from "../../../models/component.mjs"
import { modMenuState } from "../shared.mjs"
import { ComponentType } from "discord.js"

export const toggleDm = staticComponent({
  type: ComponentType.Button,
  name: "mod-dm",
  async handle(interaction) {
    if (!interaction.inCachedGuild()) {
      return
    }

    const state = await modMenuState(interaction)
    state.dm = !state.dm

    await interaction.update(await modMenu(state))
  },
})
