/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import type { ModalSubmitInteraction } from "discord.js"

export const Modals = new Map<
  string,
  (interaction: ModalSubmitInteraction) => Promise<void>
>()
