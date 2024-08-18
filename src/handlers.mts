/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { AddImageToLog } from "./handlers/addImageToLog.mjs"
import { InteractionHandler } from "./handlers/interactionHandler.mjs"
import { LevelRolesOnJoin } from "./handlers/levelRolesOnJoin.mjs"
import { LogBans } from "./handlers/logBans.mjs"
import { LogKick } from "./handlers/logKick.mjs"
import { LogTimeout } from "./handlers/logTimeout.mjs"
import { LogUnbans } from "./handlers/logUnbans.mjs"
import { LogUntimeout } from "./handlers/logUntimeout.mjs"
import { RabbitHandler } from "./handlers/rabbit.mjs"
import { ReadyHandler } from "./handlers/readyHandler.mjs"
import { UpdateLeaderboardOnJoin } from "./handlers/updateLeaderboardOnJoin.mjs"
import { UpdateLeaderboardOnLeave } from "./handlers/updateLeaderboardOnLeave.mjs"
import { UpdateLeaderboardOnStart } from "./handlers/updateLeaderboardOnStart.mjs"
import { UpdateLeaderboardOnUser } from "./handlers/updateLeaderboardOnUser.mjs"
import { XpOnMessage } from "./handlers/xpOnMessage.mjs"
import { Config } from "./models/config.mjs"
import type { Handler } from "./models/handler.mjs"
import type { ClientEvents } from "discord.js"

export const Handlers: Handler<keyof ClientEvents>[] = [
  ReadyHandler,
  InteractionHandler,
  LogBans,
  LogKick,
  LogTimeout,
  LogUnbans,
  LogUntimeout,
  AddImageToLog,
  RabbitHandler,
]

if (Config.xp.enabled) {
  Handlers.push(
    XpOnMessage,
    LevelRolesOnJoin,
    UpdateLeaderboardOnStart,
    UpdateLeaderboardOnJoin,
    UpdateLeaderboardOnLeave,
    UpdateLeaderboardOnUser,
  )
}
