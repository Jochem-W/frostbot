import { Colours } from "../models/colours.mjs"
import { type ModMenuState } from "./modMenu.mjs"
import { EmbedBuilder } from "discord.js"

export function modMenuDm(state: ModMenuState) {
  const { body, timestamp } = state

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

function formatTitle({ action }: ModMenuState) {
  switch (action) {
    case "kick":
      return `You have been kicked`
    case "warn":
      return `You have been warned`
    case "timeout":
      return `You have been timed out`
    case "ban":
      return `You have been banned`
    case "unban":
    case "note":
    case "restrain":
      throw new Error(`DMs can't be created for ${action}`)
    case "untimeout":
      return `Your timeout has been removed`
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
      throw new Error(`DMs can't be created for ${action}`)
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
