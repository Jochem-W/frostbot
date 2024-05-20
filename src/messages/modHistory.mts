/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import {
  getColour,
  formatDurationAsSingleUnit,
} from "../commands/mod/shared.mjs"
import { Colours } from "../models/colours.mjs"
import { Config } from "../models/config.mjs"
import { actionsTable } from "../schema.mjs"
import { actionsWithImages } from "../util/db.mjs"
import { tryFetchMember } from "../util/discord.mjs"
import { fileURL } from "../util/s3.mjs"
import {
  bold,
  Client,
  EmbedBuilder,
  Guild,
  time,
  TimestampStyles,
  userMention,
  type User,
  escapeStrikethrough,
  strikethrough,
  EmbedAuthorOptions,
} from "discord.js"
import { eq, asc } from "drizzle-orm"
import { Duration } from "luxon"

export async function modHistory(user: User, guild: Guild) {
  const history = await actionsWithImages({
    where: eq(actionsTable.userId, user.id),
    orderBy: asc(actionsTable.timestamp),
  })

  const member = await tryFetchMember(guild, user)

  let description = `${userMention(user.id)} created their account ${time(
    user.createdAt,
    TimestampStyles.RelativeTime,
  )}.`

  if (member?.joinedAt) {
    description += ` They joined ${guild.name} ${time(
      member.joinedAt,
      TimestampStyles.RelativeTime,
    )}.`
  } else {
    description += ` They are currently not in ${guild.name}.`
  }

  switch (history.length) {
    case 0:
      description += ` There are ${bold("no entries")} in their history.`
      break
    case 1:
      description += ` There is ${bold("1 entry")} in their history.`
      break
    default:
      description += ` There are ${bold(
        `${history.length.toString(10)} entries`,
      )}  in their history.`
      break
  }

  let embeds = [
    new EmbedBuilder()
      .setTitle(user.displayName)
      .setThumbnail(user.displayAvatarURL())
      .setDescription(description)
      .setFooter({ text: user.id })
      .setColor(Colours.cyan[400]),
  ]

  if (history.length === 0) {
    return [{ embeds, ephemeral: true }]
  }

  const replies = []
  for (const entry of history) {
    const actionEmbeds = entry.images.map((image) =>
      new EmbedBuilder()
        .setImage(fileURL(image.key).toString())
        .setColor(getColour(entry.action))
        .setURL(new URL(entry.id.toString(10), Config.url.external).toString()),
    )

    let mainEmbed = actionEmbeds[0]
    if (!mainEmbed) {
      mainEmbed = new EmbedBuilder()
      actionEmbeds.push(mainEmbed)
    }

    let footer = ""
    if (entry.dm && entry.dmSuccess) {
      footer += "Sent via DM, "
    }

    const notice = []
    if (!entry.dmSuccess) {
      notice.push("- I was unable to DM the user.")
    }

    if (!entry.actionSucess) {
      notice.push("- I was unable to execute the requested action")
    }

    footer += `ID: ${entry.id}`

    mainEmbed
      .setAuthor(await formatActionAsAuthor(user.client, entry))
      .setFooter({ text: footer })
      .setTimestamp(entry.timestamp)
      .setColor(getColour(entry.action))

    if (entry.body) {
      mainEmbed.setDescription(
        entry.revoked
          ? strikethrough(escapeStrikethrough(entry.body))
          : entry.body,
      )
    }

    if (notice.length > 0) {
      mainEmbed.setFields({ name: "⚠️ Notice", value: notice.join("\n") })
    }

    if (embeds.length + actionEmbeds.length > 10) {
      replies.push({ embeds, ephemeral: true })
      embeds = []
    }

    embeds.push(...actionEmbeds)
  }

  replies.push({ embeds, ephemeral: true })

  return replies
}

async function formatActionAsAuthor(
  client: Client<true>,
  { action, staffId, timeout, revoked }: typeof actionsTable.$inferSelect,
) {
  const staff = await client.users.fetch(staffId)

  let author: EmbedAuthorOptions
  switch (action) {
    case "unban":
      author = {
        name: `Unbanned by ${staff.displayName}`,
      }
      break
    case "kick":
      author = {
        name: `Kicked by ${staff.displayName}`,
      }
      break
    case "warn":
      author = {
        name: `Warned by ${staff.displayName}`,
      }
      break
    case "timeout":
      author = {
        name: `Timed out for ${formatDurationAsSingleUnit(
          Duration.fromMillis(timeout ?? 0).shiftToAll(),
        )} by ${staff.displayName}`,
      }
      break
    case "ban":
      author = {
        name: `Banned by ${staff.displayName}`,
      }
      break
    case "note":
      author = {
        name: `Note created by ${staff.displayName}`,
      }
      break
    case "restrain":
      author = {
        name: `Restrained by ${staff.displayName}`,
      }
      break
    case "untimeout":
      author = {
        name: `Timeout removed by ${staff.displayName}`,
      }
      break
  }

  author.iconURL = staff.displayAvatarURL()
  if (revoked) {
    author.name = `[Revoked] ${author.name}`
  }

  return author
}
