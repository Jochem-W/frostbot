/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { openModMenu } from "../commands/mod/components/openModMenu.mjs"
import {
  getColour,
  formatDurationAsSingleUnit,
  ActionStatus,
  DmStatus,
  InsertStatus,
  formatTitle,
} from "../commands/mod/shared.mjs"
import { Config } from "../models/config.mjs"
import { actionsTable, attachmentsTable } from "../schema.mjs"
import { ActionWithOptionalImages, actionWithImages } from "../util/db.mjs"
import { tryFetchMember } from "../util/discord.mjs"
import { fileURL } from "../util/s3.mjs"
import { type ModMenuState } from "./modMenu.mjs"
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  TimestampStyles,
  time,
  type MessageActionRowComponentBuilder,
  Client,
  GuildMember,
  userMention,
  User,
} from "discord.js"
import { eq } from "drizzle-orm"
import { DateTime, Duration } from "luxon"

export function modMenuLog({
  dmStatus,
  actionStatus,
  insertStatus,
  state,
  images,
}: {
  dmStatus: DmStatus
  actionStatus: ActionStatus
  insertStatus: InsertStatus
  state: Omit<ModMenuState, "permissions" | "guild">
  images?: (typeof attachmentsTable.$inferSelect)[]
}) {
  const {
    staff,
    target,
    body,
    action,
    timestamp,
    timeout,
    deleteMessageSeconds,
    timedOutUntil,
    dm,
  } = state

  const staffUser = staff instanceof GuildMember ? staff.user : staff
  const targetUser = target instanceof GuildMember ? target.user : target
  const targetMember = target instanceof User ? null : target

  const embeds =
    images?.map((image) =>
      new EmbedBuilder()
        .setImage(fileURL(image.key).toString())
        .setURL(Config.url.external)
        .setColor(getColour(state.action)),
    ) ?? []

  let mainEmbed = embeds[0]
  if (!mainEmbed) {
    mainEmbed = new EmbedBuilder()
    embeds.push(mainEmbed)
  }

  mainEmbed
    .setAuthor({
      name: formatTitle(state.staff, state.target, state.action),
      iconURL: staffUser.displayAvatarURL(),
    })
    .setThumbnail(targetUser.displayAvatarURL())
    .setColor(getColour(state.action))
    .setTimestamp(timestamp)

  let footer = ""
  if (insertStatus.success) {
    footer += `ID: ${insertStatus.id.toString(10)}`
  }

  if (dmStatus.success && dm) {
    footer += footer ? ", DM sent" : "DM sent"
  }

  if (footer) {
    mainEmbed.setFooter({ text: footer })
  }

  if (body) {
    mainEmbed.addFields({
      name: action === "note" ? "🗒️ Body" : "❔ Reason",
      value: body,
    })
  }

  if (action === "ban" && deleteMessageSeconds) {
    const duration = Duration.fromObject({ seconds: deleteMessageSeconds })
    const since = DateTime.fromJSDate(timestamp).minus(duration).toJSDate()
    mainEmbed.addFields({
      name: "🗑️ Messages deleted",
      value: `Last ${shiftDuration(duration).toHuman()} (since ${time(
        since,
        TimestampStyles.ShortTime,
      )} ${time(since, TimestampStyles.ShortDate)})`,
    })
  }

  if (
    action === "timeout" &&
    timeout &&
    targetMember?.communicationDisabledUntil
  ) {
    mainEmbed.addFields({
      name: "🕑 Will be unmuted",
      value: `${time(
        targetMember.communicationDisabledUntil,
        TimestampStyles.RelativeTime,
      )} (${shiftDuration(Duration.fromMillis(timeout)).toHuman()})`,
    })
  }

  if (action === "untimeout" && timedOutUntil) {
    mainEmbed.addFields({
      name: "🕑 Timeout amount skipped",
      value: formatDurationAsSingleUnit(
        DateTime.fromJSDate(timedOutUntil).diffNow().shiftToAll(),
      ),
    })
  }

  mainEmbed.addFields(
    { name: "👤 User", value: userMention(targetUser.id), inline: true },
    { name: "#️⃣ User ID", value: targetUser.id, inline: true },
  )

  const notice = []
  if (!dmStatus.success) {
    let line
    let prepend = true
    switch (dmStatus.error) {
      case "not_in_server":
        line = "because the user isn't in the server."
        break
      case "cannot_send":
        line = "because the user's DMs aren't open, or because they blocked me."
        break
      case "unknown":
        line = "because of an unknown reason."
        break
      case "action_failed":
        line = "- I didn't send a DM to the user, because the action failed."
        prepend = false
    }

    if (prepend) {
      line = "- I was unable to send a DM to the user, " + line
    }

    notice.push(line)
  }

  if (!actionStatus.success) {
    let line
    switch (actionStatus.error) {
      case "not_in_server":
        line = "because the user isn't in the server."
        break
      case "timeout_duration":
        line = "because the selected timeout duration is invalid."
        break
      case "unhandled":
        line = "because performing that action hasn't been implemented yet."
        break
      case "unknown":
        line = "because of an unknown reason."
        break
    }

    line = formatActionFail(state) + line

    notice.push(line)
  }

  if (!insertStatus.success) {
    notice.push(
      "- The moderation log wasn't stored in the database, because of an unexpected error.",
    )
  }

  if (notice.length > 0) {
    mainEmbed.addFields({ name: "⚠️ Notice", value: notice.join("\n") })
  }

  const components = []
  if (action === "restrain") {
    components.push(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().setComponents(
        new ButtonBuilder()
          .setLabel("Open mod menu")
          .setStyle(ButtonStyle.Primary)
          .setCustomId(openModMenu),
      ),
    )
  }

  return {
    embeds,
    components,
  }
}

export async function modMenuLogFromDb(
  client: Client<true>,
  options: typeof actionsTable.$inferSelect.id | ActionWithOptionalImages,
) {
  let data
  if (typeof options === "number") {
    data = await actionWithImages(eq(actionsTable.id, options))
  } else {
    data = options
  }

  const guild = await client.guilds.fetch(data.guildId)
  const targetUser = await client.users.fetch(data.userId)
  const targetMember = await tryFetchMember(guild, targetUser)
  const staffUser = await client.users.fetch(data.staffId)
  const staffMember = await tryFetchMember(guild, staffUser)

  const params: Parameters<typeof modMenuLog>[0] = {
    dmStatus: data.dmSuccess
      ? { success: true }
      : { success: false, error: "unknown" },
    actionStatus: data.actionSucess
      ? { success: true }
      : { success: false, error: "unknown" },
    insertStatus: { success: true, id: data.id },
    state: {
      target: targetMember ?? targetUser,
      action: data.action,
      staff: staffMember ?? staffUser,
      timestamp: data.timestamp,
      dm: data.dm,
    },
  }

  if (data.images) {
    params.images = data.images
  }

  if (data.deleteMessageSeconds !== null) {
    params.state.deleteMessageSeconds = data.deleteMessageSeconds
  }

  if (data.body) {
    params.state.body = data.body
  }

  if (data.timeout) {
    params.state.timeout = data.timeout
  }

  if (targetMember) {
    params.state.target = targetMember
  }

  if (data.timedOutUntil) {
    params.state.timedOutUntil = data.timedOutUntil
  }

  return modMenuLog(params)
}

function formatActionFail({
  action,
  target,
}: Pick<ModMenuState, "action" | "target">) {
  switch (action) {
    case "unban":
    case "kick":
    case "ban":
    case "restrain":
    case "warn":
      return `I wasn't able to ${action} ${userMention(target.id)}, `
    case "timeout":
      return `I wasn't able to time ${userMention(target.id)} out, `
    case "note":
      return `I wasn't able to create a note for ${userMention(target.id)}, `
    case "untimeout":
      return `I wasn't able to remove the timeout for ${userMention(
        target.id,
      )}, `
  }
}

function shiftDuration(duration: Duration) {
  return Duration.fromObject(
    Object.fromEntries(
      Object.entries(duration.shiftToAll().toObject()).filter(
        ([, value]) => value !== 0,
      ),
    ),
  )
}
