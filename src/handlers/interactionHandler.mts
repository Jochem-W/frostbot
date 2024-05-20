/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { RegisteredCommands } from "../commands.mjs"
import { Components } from "../components.mjs"
import { Modals } from "../modals.mjs"
import { Colours } from "../models/colours.mjs"
import type { Command } from "../models/command.mjs"
import { handler } from "../models/handler.mjs"
import {
  ApplicationCommandType,
  AutocompleteInteraction,
  CommandInteraction,
  EmbedBuilder,
  InteractionType,
  MessageComponentInteraction,
  ModalSubmitInteraction,
} from "discord.js"

function commandNotFound(
  interaction: CommandInteraction | AutocompleteInteraction,
): never {
  throw new Error(
    `Couldn't find the command ${interaction.commandName} (${interaction.commandId})`,
  )
}

function commandTypeMismatch(
  interaction: CommandInteraction | AutocompleteInteraction,
  command: Command<ApplicationCommandType>,
): never {
  throw new Error(
    `Interaction command type mismatch; expected ${command.type}, got ${interaction.commandType}`,
  )
}

function invalidCustomId(
  interaction: MessageComponentInteraction | ModalSubmitInteraction,
): never {
  throw new Error(`Invalid custom ID ${interaction.customId}`)
}

async function handleCommand(interaction: CommandInteraction) {
  const command = RegisteredCommands.get(interaction.commandId)
  if (!command) {
    commandNotFound(interaction)
  }

  if (command.type !== interaction.commandType) {
    commandTypeMismatch(interaction, command)
  }

  await command.handle(interaction as never)
}

async function handleComponent(interaction: MessageComponentInteraction) {
  const [componentName] = interaction.customId.split(":")
  if (!componentName) {
    invalidCustomId(interaction)
  }

  const component = Components.get(componentName)
  if (!component) {
    throw new Error(`Couldn't find a component with name ${componentName}`)
  }

  if (component.type !== interaction.componentType) {
    throw new Error(
      `Interaction component type mismatch; expected ${component.type}, got ${interaction.componentType}`,
    )
  }

  await component.handle(interaction as never)
}

async function handleAutocomplete(interaction: AutocompleteInteraction) {
  const command = RegisteredCommands.get(interaction.commandId)
  if (!command) {
    commandNotFound(interaction)
  }

  if (command.type !== interaction.commandType) {
    commandTypeMismatch(interaction, command)
  }

  await command.autocomplete(interaction)
}

async function handleModal(interaction: ModalSubmitInteraction) {
  const [modalName] = interaction.customId.split(":")
  if (!modalName) {
    invalidCustomId(interaction)
  }

  const modal = Modals.get(modalName)
  if (!modal) {
    throw new Error(`Couldn't find a modal with name ${modalName}`)
  }

  await modal(interaction)
}

export const InteractionHandler = handler({
  event: "interactionCreate",
  once: false,
  async handle(interaction) {
    const start = performance.now()
    try {
      switch (interaction.type) {
        case InteractionType.ApplicationCommand:
          await handleCommand(interaction)
          break
        case InteractionType.MessageComponent:
          await handleComponent(interaction)
          break
        case InteractionType.ApplicationCommandAutocomplete:
          await handleAutocomplete(interaction)
          break
        case InteractionType.ModalSubmit:
          await handleModal(interaction)
          break
      }
    } catch (e) {
      if (!interaction.isRepliable()) {
        throw e
      }

      const embeds = [
        new EmbedBuilder()
          .setColor(Colours.red[500])
          .setTitle("An error occurred while executing this command"),
      ]

      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds })
        throw e
      }

      await interaction.reply({ embeds, ephemeral: true })
      throw e
    }

    console.log("Took", performance.now() - start)
  },
})
