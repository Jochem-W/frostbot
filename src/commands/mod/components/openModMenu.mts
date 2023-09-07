import { ModMenuState, modMenu } from "../../../messages/modMenu.mjs"
import { staticComponent } from "../../../models/component.mjs"
import { tryFetchMember } from "../../../util/discord.mjs"
import { ComponentType } from "discord.js"

export const openModMenu = staticComponent({
  type: ComponentType.Button,
  name: "mod-menu",
  async handle(interaction) {
    if (!interaction.inCachedGuild()) {
      return
    }

    const { guild, createdAt, message, member } = interaction

    const userId = message.embeds[0]?.fields.find((field) =>
      field.name.includes("User ID"),
    )?.value
    if (!userId) {
      return
    }

    const target = await interaction.client.users.fetch(userId)
    const state: ModMenuState = {
      guild,
      action: "restrain",
      dm: false,
      timestamp: createdAt,
      target,
      staff: member,
      deleteMessageSeconds: 0,
    }

    const targetMember = await tryFetchMember(guild, target)
    if (targetMember) {
      state.target = targetMember
    }

    await interaction.reply(await modMenu(state))
    await interaction.message.edit({ components: [] })
  },
})
