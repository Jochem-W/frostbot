import type { ModalSubmitInteraction } from "discord.js"

export const Modals = new Map<
  string,
  (interaction: ModalSubmitInteraction) => Promise<void>
>()
