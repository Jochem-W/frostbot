import type {
  DmStatus,
  ActionStatus,
  InsertStatus,
} from "../commands/mod/components.mjs"
import { Colours } from "../models/colours.mjs"
import { type ModMenuState } from "./modMenu.mjs"
import { EmbedBuilder } from "discord.js"

function formatAction({ action, guild, targetUser }: ModMenuState) {
  let value
  let prepend = true
  switch (action) {
    case "unban":
      value = "unbanned from "
      break
    case "kick":
      value = "kicked from "
      break
    case "warn":
      value = "warned in "
      break
    case "timeout":
      value = "timed out in "
      break
    case "ban":
      value = "banned from "
      break
    case "note":
      value = `A note has been created for ${targetUser.toString()} in`
      prepend = false
      break
    case "restrain":
      value = "restrained in "
      break
    case "untimeout":
      value = `${targetUser.toString()}'s timeout has been removed in `
      prepend = false
      break
  }

  if (prepend) {
    value = `${targetUser.toString()} has been ` + value
  }

  value += `${guild.name}.`
  return value
}

type Data =
  | {
      state: ModMenuState
    }
  | {
      state: ModMenuState
      dmStatus: DmStatus
      actionStatus: ActionStatus
      insertStatus: InsertStatus
    }

export function modMenuSuccess(data: Data) {
  const { state } = data
  const { targetUser, action } = state

  if (action === undefined) {
    throw new Error() // TODO
  }

  if (!("dmStatus" in data)) {
    return {
      embeds: [
        new EmbedBuilder()
          .setTitle("Failure!")
          .setDescription(
            `I do not have the required permissions to perform a ${action} on ${targetUser.toString()}, or the user is not in the server.`,
          )
          .setColor(Colours.red[500]),
      ],
      components: [],
    }
  }

  const embed = new EmbedBuilder().setDescription(formatAction(state))

  const {
    actionStatus,
    dmStatus,
    insertStatus,
    state: { guild },
  } = data
  if (actionStatus.success) {
    if (dmStatus.success && insertStatus.success) {
      embed.setTitle("Success!").setColor(Colours.green[500])
    } else {
      embed.setTitle("Partial success!").setColor(Colours.amber[500])
    }
  } else {
    embed.setTitle("Failure!").setDescription(null).setColor(Colours.red[500])
  }

  if (!dmStatus.success) {
    let value
    switch (dmStatus.error) {
      case "cannot_send":
        value =
          "I was unable to send the user a message, because they either only allow messages from friends, or because they blocked the bot."
        break
      case "not_in_server":
        value = `I was unable to send the user a message, because they're not in ${guild.name}.`
        break
      case "unknown":
        value = "I was unable to send the user a message for an unknown reason"
        break
      case "action_failed":
        value = "I didn't send the user a message, because the action failed."
    }
    embed.addFields({
      name: "❌ No DM was sent",
      value,
    })
  }

  if (!actionStatus.success) {
    let value
    switch (actionStatus.error) {
      case "not_in_server":
        value = `I was unable to perform the requested action, because the user is not in ${guild.name}.`
        break
      case "timeout_duration":
        value =
          "I was unable to time the user out, because the requested timeout duration is invalid."
        break
      case "unhandled":
        value =
          "I was unable to perform the requested action, because it hasn't been implemented yet."
        break
      case "unknown":
        value =
          "I was unable to perform the requested action due to an unknown reason."
        break
    }

    embed.addFields({
      name: "❌ No action was taken",
      value,
    })
  }

  if (!insertStatus.success) {
    embed.addFields({
      name: "❌ Database insertion failed",
      value:
        "Due to an unexpected error, the moderation log couldn't be stored in the database.",
    })
  }

  return {
    embeds: [embed],
    components: [],
  }
}
