/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { Handlers } from "./handlers.mjs"
import { Handler } from "./models/handler.mjs"
import { Variables } from "./models/variables.mjs"
import { logError } from "./util/error.mjs"
import { Client, ClientEvents, GatewayIntentBits, Partials } from "discord.js"

const discord = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [
    Partials.User,
    Partials.Channel,
    Partials.GuildMember,
    Partials.Message,
    Partials.Reaction,
    Partials.GuildScheduledEvent,
    Partials.ThreadMember,
  ],
})

async function listener<T extends keyof ClientEvents>(
  handler: Handler<T>,
  ...args: ClientEvents[T]
) {
  try {
    await handler.handle(...args)
  } catch (e) {
    await logError(discord, e)
  }
}

for (const handler of Handlers) {
  console.log("Registering handler for", handler.event)

  if (handler.once) {
    discord.once(handler.event, (...args) => void listener(handler, ...args))
    continue
  }

  discord.on(handler.event, (...args) => void listener(handler, ...args))
}

await discord.login(Variables.botToken)
