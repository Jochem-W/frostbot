import { formatDurationAsSingleUnit } from "../commands/mod/shared.mjs"
import { Colours } from "../models/colours.mjs"
import { type ModMenuState } from "./modMenu.mjs"
import { EmbedBuilder } from "discord.js"
import { Duration } from "luxon"

export function modMenuDm(state: ModMenuState) {
  const { body, timestamp } = state

  const embed = new EmbedBuilder()
    .setTitle(formatTitle(state))
    .setDescription(formatDescription(state))
    .setColor(Colours.red[500])
    .setTimestamp(timestamp)

  if (body) {
    embed.setFields({ name: "Reason", value: body })
  }

  return { embeds: [embed] }
}

function formatTitle({ action, guild }: ModMenuState) {
  let text
  switch (action) {
    case "kick":
      text = `You have been kicked in `
      break
    case "warn":
      text = `You have been warned in `
      break
    case "timeout":
      text = `You have been timed out in `
      break
    case "ban":
      text = `You have been banned from `
      break
    case "unban":
    case "note":
    case "restrain":
      throw new Error(`DMs can't be created for ${action}`)
    case "untimeout":
      text = `Your timeout has been removed in `
      break
  }

  text += guild.name

  return text
}

function formatDescription({ action, timeout }: ModMenuState) {
  let value
  let prepend = true
  switch (action) {
    case "timeout":
      value = timeout
        ? `timed out for ${formatDurationAsSingleUnit(
            Duration.fromMillis(timeout).shiftToAll(),
          )}`
        : "timed out."
      break
    case "ban":
      value = "banned."
      break
    case "kick":
      value = "kicked."
      break
    case "warn":
      value = "warned."
      break
    case "unban":
    case "note":
    case "restrain":
      throw new Error(`DMs can't be created for ${action}`)
    case "untimeout":
      value = "A moderator has removed your timeout."
      prepend = false
      break
  }

  if (!prepend) {
    return value
  }

  return (
    "Your behaviour has been in violation of our rules, and as a result, you have been " +
    value
  )
}
