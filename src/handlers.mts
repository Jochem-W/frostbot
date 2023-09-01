import { InteractionHandler } from "./handlers/interactionHandler.mjs"
import { JoinHandler } from "./handlers/joinHandler.mjs"
import { MemberAddHandler } from "./handlers/memberAddHandler.mjs"
import { MemberRemoveHandler } from "./handlers/memberRemoveHandler.mjs"
import { PopulateLeaderboard } from "./handlers/populateLeaderboard.mjs"
import { ReadyHandler } from "./handlers/readyHandler.mjs"
import { UserUpdateHandler } from "./handlers/userUpdateHandler.mjs"
import { XpHandler } from "./handlers/xpHandler.mjs"
import type { Handler } from "./models/handler.mjs"
import type { ClientEvents } from "discord.js"

export const Handlers: Handler<keyof ClientEvents>[] = [
  ReadyHandler,
  InteractionHandler,
  XpHandler,
  JoinHandler,
  PopulateLeaderboard,
  MemberAddHandler,
  MemberRemoveHandler,
  UserUpdateHandler,
]
