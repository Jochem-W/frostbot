import { InteractionHandler } from "./handlers/interactionHandler.mjs"
import { LevelRolesOnJoin } from "./handlers/levelRolesOnJoin.mjs"
import { ReadyHandler } from "./handlers/readyHandler.mjs"
import { UpdateLeaderboardOnJoin } from "./handlers/updateLeaderboardOnJoin.mjs"
import { UpdateLeaderboardOnLeave } from "./handlers/updateLeaderboardOnLeave.mjs"
import { UpdateLeaderboardOnStart } from "./handlers/updateLeaderboardOnStart.mjs"
import { UpdateLeaderboardOnUser } from "./handlers/updateLeaderboardOnUser.mjs"
import { XpOnMessage } from "./handlers/xpOnMessage.mjs"
import type { Handler } from "./models/handler.mjs"
import type { ClientEvents } from "discord.js"

export const Handlers: Handler<keyof ClientEvents>[] = [
  ReadyHandler,
  InteractionHandler,
  XpOnMessage,
  LevelRolesOnJoin,
  UpdateLeaderboardOnStart,
  UpdateLeaderboardOnJoin,
  UpdateLeaderboardOnLeave,
  UpdateLeaderboardOnUser,
]
