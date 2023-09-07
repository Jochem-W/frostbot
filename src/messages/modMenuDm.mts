import { Colours } from "../models/colours.mjs"
import { type ModMenuState } from "./modMenu.mjs"
import { EmbedBuilder } from "discord.js"

export function modMenuDm(state: ModMenuState) {
  const { body, timestamp } = state

  const embed = new EmbedBuilder()
    .setTitle(formatTitle(state))
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
