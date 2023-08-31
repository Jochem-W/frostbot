import {
  MessageContextMenuCommands,
  RegisteredCommands,
  SlashCommands,
  UserContextMenuCommands,
} from "../commands.mjs"
import type { Command } from "../models/command.mjs"
import { handler } from "../models/handler.mjs"
import { Variables } from "../models/variables.mjs"
import {
  Routes,
  type RESTPutAPIApplicationCommandsResult,
  ApplicationCommandType,
} from "discord.js"

export const ReadyHandler = handler({
  event: "ready",
  once: true,
  async handle(client) {
    console.log("Running as", client.user.tag)

    function exitListener() {
      client.destroy().catch(console.error)
    }

    process.on("SIGINT", exitListener)
    process.on("SIGTERM", exitListener)

    const built = []
    for (const command of [
      SlashCommands,
      UserContextMenuCommands,
      MessageContextMenuCommands,
    ].flat()) {
      built.push(command.builder.toJSON())
    }

    client.rest.setToken(Variables.botToken)
    const applicationCommands = (await client.rest.put(
      Routes.applicationCommands(client.application.id),
      { body: built },
    )) as RESTPutAPIApplicationCommandsResult

    for (const applicationCommand of applicationCommands) {
      let command: Command<ApplicationCommandType> | undefined
      switch (applicationCommand.type) {
        case ApplicationCommandType.ChatInput:
          command = SlashCommands.find(
            (command) => command.builder.name === applicationCommand.name,
          )
          break
        case ApplicationCommandType.User:
          command = UserContextMenuCommands.find(
            (command) => command.builder.name === applicationCommand.name,
          )
          break
        case ApplicationCommandType.Message:
          command = MessageContextMenuCommands.find(
            (command) => command.builder.name === applicationCommand.name,
          )
          break
      }

      if (!command) {
        throw new Error(
          `Couldn't find a command with the name ${applicationCommand.name}`,
        )
      }

      RegisteredCommands.set(applicationCommand.id, command)
    }
  },
})
