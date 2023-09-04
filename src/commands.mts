import { ModCommand } from "./commands/mod/chatCommand.mjs"
import { ModUserContextCommand } from "./commands/mod/userContextCommand.mjs"
import { RankCommand } from "./commands/rankCommand.mjs"
import { RestoreLevelCommand } from "./commands/restoreLevelCommand.mjs"
import { XpCommand } from "./commands/xpCommand.mjs"
import type { Command } from "./models/command.mjs"
import type { ApplicationCommandType, Snowflake } from "discord.js"

export const SlashCommands: Command<ApplicationCommandType.ChatInput>[] = [
  ModCommand,
  RankCommand,
  XpCommand,
]
export const MessageContextMenuCommands: Command<ApplicationCommandType.Message>[] =
  [RestoreLevelCommand]

export const UserContextMenuCommands: Command<ApplicationCommandType.User>[] = [
  ModUserContextCommand,
]

export const RegisteredCommands = new Map<
  Snowflake,
  Command<ApplicationCommandType>
>()
