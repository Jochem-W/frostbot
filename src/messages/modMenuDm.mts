import { Colours } from "../models/colours.mjs"
import { Config } from "../models/config.mjs"
import { attachmentsTable } from "../schema.mjs"
import { fileURL } from "../util/s3.mjs"
import { type ModMenuState } from "./modMenu.mjs"
import { EmbedBuilder } from "discord.js"

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
    .setTitle(formatTitle(state))
    .setColor(Colours.red[500])
    .setTimestamp(timestamp)

  if (body) {
    mainEmbed.setFields({ name: "Reason", value: body })
  }

  return { embeds }
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
