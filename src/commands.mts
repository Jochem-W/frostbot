/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { BotCommand } from "./commands/bot.mjs"
import { LeaderboardCommand } from "./commands/leaderboardCommand.mjs"
import { ModCommand } from "./commands/mod/chatCommand.mjs"
import { ModUserContextCommand } from "./commands/mod/userContextCommand.mjs"
import { PaletteCommand } from "./commands/palette.mjs"
import { RankCommand } from "./commands/rank/chatCommand.mjs"
import { RankContextCommand } from "./commands/rank/contextMenuCommand.mjs"
import { RestoreLevelCommand } from "./commands/restoreLevelCommand.mjs"
import { SocialsCommand } from "./commands/socials.mjs"
import { ToggleInvitesCommand } from "./commands/toggleInvitesCommand.mjs"
import { ToyhouseCommmand } from "./commands/toyhouse.mjs"
import { XpCommand } from "./commands/xpCommand.mjs"
import type { Command } from "./models/command.mjs"
import { Config } from "./models/config.mjs"
import type { ApplicationCommandType, Snowflake } from "discord.js"

export const SlashCommands: Command<ApplicationCommandType.ChatInput>[] = [
  ModCommand,
  ToggleInvitesCommand,
]

export const MessageContextMenuCommands: Command<ApplicationCommandType.Message>[] =
  []

export const UserContextMenuCommands: Command<ApplicationCommandType.User>[] = [
  ModUserContextCommand,
]

export const RegisteredCommands = new Map<
  Snowflake,
  Command<ApplicationCommandType>
>()

if (Config.xp.enabled) {
  SlashCommands.push(RankCommand, XpCommand, LeaderboardCommand)
  MessageContextMenuCommands.push(RestoreLevelCommand)
  UserContextMenuCommands.push(RankContextCommand)
}

if (Config.fun) {
  SlashCommands.push(
    BotCommand,
    PaletteCommand,
    SocialsCommand,
    ToyhouseCommmand,
  )
}
