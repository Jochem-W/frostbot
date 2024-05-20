/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
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

export enum InstallationContext {
  GuildInstall = 0,
  UserInstall = 1,
}

export enum InteractionContext {
  Guild = 0,
  BotDm = 1,
  PrivateChannel = 2,
}
