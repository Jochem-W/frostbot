import type {
  ApplicationCommandType,
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  ContextMenuCommandBuilder,
  MessageContextMenuCommandInteraction,
  SlashCommandBuilder,
  UserContextMenuCommandInteraction,
} from "discord.js"

export type Command<T extends ApplicationCommandType> =
  T extends ApplicationCommandType.ChatInput
    ? {
        type: T
        builder: SlashCommandBuilder
        handle: (interaction: ChatInputCommandInteraction) => void
        autocomplete: (interaction: AutocompleteInteraction) => Promise<void>
      }
    : T extends ApplicationCommandType.Message
    ? {
        type: T
        builder: ContextMenuCommandBuilder
        handle: (
          interaction: MessageContextMenuCommandInteraction,
        ) => Promise<void>
      }
    : T extends ApplicationCommandType.User
    ? {
        type: T
        builder: ContextMenuCommandBuilder
        handle: (
          interaction: UserContextMenuCommandInteraction,
        ) => Promise<void>
      }
    : never
