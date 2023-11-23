import {
  DmStatus,
  ActionStatus,
  InsertStatus,
  InsertImagesStatus,
} from "../commands/mod/shared.mjs"
import { Colours } from "../models/colours.mjs"
import { type ModMenuState } from "./modMenu.mjs"
import { EmbedBuilder, userMention } from "discord.js"

type Data =
  | {
      state: ModMenuState
      dmStatus?: never
      actionStatus?: never
      insertStatus?: never
      insertImagesStatus?: never
    }
  | {
      state: ModMenuState
      dmStatus: DmStatus
      actionStatus: ActionStatus
      insertStatus: InsertStatus
      insertImagesStatus?: InsertImagesStatus | null
    }

export function modMenuSuccess(data: Data) {
  const { state } = data
  const { target, action } = state

  if (!("dmStatus" in data)) {
    return {
      embeds: [
        new EmbedBuilder()
          .setTitle("Failure!")
          .setDescription(
            `You do not have the required permissions to perform a ${action} on ${userMention(
              target.id,
            )}, or the user is not in the server.`,
          )
          .setColor(Colours.red[500]),
      ],
      ephemeral: true,
      components: [],
    }
  }

  const embed = new EmbedBuilder().setDescription(formatAction(state))

  const {
    actionStatus,
    dmStatus,
    insertStatus,
    insertImagesStatus,
    state: { guild },
  } = data
  if (actionStatus && actionStatus.success) {
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

  if (actionStatus && !actionStatus.success) {
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

  if (insertStatus && !insertStatus.success) {
    embed.addFields({
      name: "❌ Database insertion failed",
      value:
        "Due to an unexpected error, the moderation log couldn't be stored in the database.",
    })
  }

  if (insertImagesStatus && !insertImagesStatus.success) {
    embed.addFields({
      name: "❌ Image insertion failed",
      value:
        "Due to an unexpected error, some images couldn't be linked to the action log in the database.",
    })
  }

  return {
    embeds: [embed],
    components: [],
    ephemeral: true,
  }
}

function formatAction({ action, target }: ModMenuState) {
  let value
  let prepend = true
  switch (action) {
    case "unban":
      value = "unbanned"
      break
    case "kick":
      value = "kicked"
      break
    case "warn":
      value = "warned"
      break
    case "timeout":
      value = "timed out"
      break
    case "ban":
      value = "banned"
      break
    case "note":
      value = `A note has been created for ${userMention(target.id)}.`
      prepend = false
      break
    case "restrain":
      value = "restrained"
      break
    case "untimeout":
      value = `${userMention(target.id)}'s timeout has been removed.`
      prepend = false
      break
  }

  if (prepend) {
    value = `${userMention(target.id)} has been ${value}.`
  }

  return value
}
