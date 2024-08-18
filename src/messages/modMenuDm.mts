/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { Colours } from "../models/colours.mjs"
import { Config } from "../models/config.mjs"
import { attachmentsTable } from "../schema.mjs"
import { fileURL } from "../util/s3.mjs"
import { type ModMenuState } from "./modMenu.mjs"
import { EmbedAuthorOptions, EmbedBuilder } from "discord.js"

export function modMenuDm(
  state: ModMenuState,
  images?: (typeof attachmentsTable.$inferSelect)[],
) {
  const { body, timestamp } = state

  const embeds =
    images?.map((image) =>
      new EmbedBuilder()
        .setImage(fileURL(image.key).toString())
        .setURL(Config.url.external)
        .setColor(Colours.red[500]),
    ) ?? []

  let mainEmbed = embeds[0]
  if (!mainEmbed) {
    mainEmbed = new EmbedBuilder()
    embeds.push(mainEmbed)
  }

  mainEmbed
    .setAuthor(formatAuthor(state))
    .setColor(Colours.red[500])
    .setTimestamp(timestamp)

  if (body) {
    mainEmbed.setFields({ name: "Reason", value: body })
  }

  return { embeds }
}

function formatAuthor({ action, guild }: ModMenuState) {
  let name
  switch (action) {
    case "kick":
      name = `You have been kicked in `
      break
    case "warn":
      name = `You have been warned in `
      break
    case "timeout":
      name = `You have been timed out in `
      break
    case "ban":
      name = `You have been banned from `
      break
    case "unban":
    case "note":
    case "restrain":
      throw new Error(`DMs can't be created for ${action}`)
    case "untimeout":
      name = `Your timeout has been removed in `
      break
  }

  name += guild.name

  const author: EmbedAuthorOptions = { name }
  const icon = guild.iconURL()
  if (icon) {
    author.iconURL = icon
  }

  return author
}
