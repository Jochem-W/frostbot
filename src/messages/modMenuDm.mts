import { Colours } from "../models/colours.mjs"
import { type ModMenuState } from "./modMenu.mjs"
import { EmbedBuilder } from "discord.js"

function formatTitle({ action, guild }: ModMenuState) {
  switch (action) {
    case "kick":
      return `You have been kicked from ${guild.name}.`
    case "warn":
      return `You have been warned in ${guild.name}.`
    case "timeout":
      return `You have been timed out in ${guild.name}.`
    case "ban":
      return `You have been banned from ${guild.name}.`
    case "unban":
    case "note":
    case "restrain":
      throw new Error() // TODO
    case "untimeout":
      return `Your timeout has been removed in ${guild.name}.`
  }
}

function formatDescription({ action, guild }: ModMenuState) {
  let value
  let prepend = true
  switch (action) {
    case "timeout":
      value = "timed out in "
      break
    case "ban":
      value = "banned from "
      break
    case "kick":
      value = "kicked from "
      break
    case "warn":
      value = "warned in "
      break
    case "unban":
    case "note":
    case "restrain":
      throw new Error() // TODO
    case "untimeout":
      value = "A moderator has removed your timeout in "
      prepend = false
      break
  }

  if (prepend) {
    value =
      "A moderator has decided that your behaviour has been in violation of our rules, and as a result, you have been " +
      value
  }

  value += `${guild.name}.`
  return value
}

export function modMenuDm(state: ModMenuState) {
  const { action, body, timestamp } = state
  if (!action) {
    throw new Error() // TODO
  }

  const embed = new EmbedBuilder()
    .setAuthor({
      name: formatTitle(state),
      iconURL: state.guild.client.user.displayAvatarURL(),
    })
    .setDescription(formatDescription(state))
    .setColor(Colours.red[500])
    .setTimestamp(timestamp)

  if (body) {
    embed.setFields({ name: "Reason", value: body })
  }

  return { embeds: [embed] }
}
