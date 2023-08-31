import { InteractionHandler } from "./handlers/interactionHandler.mjs"
import { JoinHandler } from "./handlers/joinHandler.mjs"
import { ReadyHandler } from "./handlers/readyHandler.mjs"
import { XpHandler } from "./handlers/xpHandler.mjs"
import type { Handler } from "./models/handler.mjs"
import type { ClientEvents } from "discord.js"

export const Handlers: Handler<keyof ClientEvents>[] = [
  ReadyHandler,
  InteractionHandler,
  XpHandler,
  JoinHandler,
]
