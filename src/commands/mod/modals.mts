import { modMenuState, modMenu } from "../../messages/modMenu.mjs"
import { modal, modalInput } from "../../models/modal.mjs"
import {
  TextInputBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
} from "discord.js"

export const setBodyModal = modal({
  id: "mod-body",
  title: "Set note body",
  components: [
    modalInput(
      "body",
      true,
      new TextInputBuilder()
        .setLabel("What should the body for this note be?")
        .setStyle(TextInputStyle.Paragraph),
    ),
  ],
  handle: handleReasonOrBody,
})

export const setReasonModal = modal({
  id: "mod-reason",
  title: "Set action reason",
  components: [
    modalInput(
      "body",
      true,
      new TextInputBuilder()
        .setLabel("What should the reason for this action be?")
        .setStyle(TextInputStyle.Paragraph),
    ),
  ],
  handle: handleReasonOrBody,
})

async function handleReasonOrBody(
  interaction: ModalSubmitInteraction,
  { body }: { body: string },
) {
  if (!interaction.isFromMessage()) {
    return
  }

  if (!interaction.inCachedGuild()) {
    return
  }

  const state = await modMenuState(interaction)
  state.body = body

  await interaction.update(await modMenu(state))
}
