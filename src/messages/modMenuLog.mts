import {
  openModMenu,
  type DmStatus,
  type ActionStatus,
  type InsertStatus,
} from "../commands/mod/components.mjs"
import { actionsTable } from "../schema.mjs"
import { tryFetchMember } from "../util/discord.mjs"
import { formatDuration, getColour, type ModMenuState } from "./modMenu.mjs"
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  TimestampStyles,
  time,
  type MessageActionRowComponentBuilder,
  Client,
} from "discord.js"
import { DateTime, Duration } from "luxon"

function formatTitle({
  action,
  staffMember,
  targetUser,
}: Pick<ModMenuState, "action" | "staffMember" | "targetUser">) {
  switch (action) {
    case "warn":
      return `${staffMember.user.displayName} issued a warning on ${targetUser.displayName}`
    case "kick":
    case "timeout":
    case "ban":
      return `${staffMember.user.displayName} issued a ${action} on ${targetUser.displayName}`
    case "restrain":
      return `${staffMember.user.displayName} issued a restraint on ${targetUser.displayName}`
    case "note":
      return `${staffMember.user.displayName} created a note for ${targetUser.displayName}`
    case "untimeout":
      return `${staffMember.user.displayName} removed a timeout for ${targetUser.displayName}`
    case "unban":
      return `${staffMember.user.displayName} removed a ban for ${targetUser.displayName}`
  }
}

function formatActionFail({
  action,
  targetUser,
}: Pick<ModMenuState, "action" | "targetUser">) {
  switch (action) {
    case "unban":
    case "kick":
    case "ban":
    case "restrain":
    case "warn":
      return `I wasn't able to ${action} ${targetUser.toString()}, `
    case "timeout":
      return `I wasn't able to time ${targetUser.toString()} out, `
    case "note":
      return `I wasn't able to create a note for ${targetUser.toString()}, `
    case "untimeout":
      return `I wasn't able to remove the timeout for ${targetUser.toString()}, `
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

export async function modMenuLogFromDb(
  client: Client<true>,
  data: typeof actionsTable.$inferSelect,
) {
  const guild = await client.guilds.fetch(data.guildId)
  const targetUser = await client.users.fetch(data.userId)
  const targetMember = await tryFetchMember(guild, targetUser)
  const staffMember = await guild.members.fetch(data.staffId)

  const options: Parameters<typeof modMenuLog>[0] = {
    dmStatus: data.dmSuccess
      ? { success: true }
      : { success: false, error: "unknown" },
    actionStatus: data.actionSucess
      ? { success: true }
      : { success: false, error: "unknown" },
    insertStatus: { success: true, id: data.id },
    state: {
      targetUser,
      action: data.action,
      staffMember,
      timestamp: data.timestamp,
    },
  }

  if (data.deleteMessageSeconds !== null) {
    options.state.deleteMessageSeconds = data.deleteMessageSeconds
  }

  if (data.body) {
    options.state.body = data.body
  }

  if (data.timeout) {
    options.state.timeout = data.timeout
  }

  if (targetMember) {
    options.state.targetMember = targetMember
  }

  if (data.timedOutUntil) {
    options.state.timedOutUntil = data.timedOutUntil
  }

  return modMenuLog(options)
}

export function modMenuLog({
  dmStatus,
  actionStatus,
  insertStatus,
  state,
}: {
  dmStatus: DmStatus
  actionStatus: ActionStatus
  insertStatus: InsertStatus
  state: Omit<ModMenuState, "permissions" | "guild" | "dm">
}) {
  const {
    staffMember,
    targetUser,
    targetMember,
    body,
    action,
    timestamp,
    timeout,
    deleteMessageSeconds,
    timedOutUntil,
  } = state

  const embed = new EmbedBuilder()
    .setAuthor({
      name: formatTitle(state),
      iconURL: staffMember.user.displayAvatarURL(),
    })
    .setThumbnail(targetUser.displayAvatarURL())
    .setColor(getColour(state.action))
    .setTimestamp(timestamp)

  if (insertStatus.success) {
    embed.setFooter({ text: insertStatus.id.toString(10) })
  }

  if (body) {
    embed.addFields({
      name: action === "note" ? "🗒️ Body" : "❔ Reason",
      value: body,
    })
  }

  if (action === "ban" && deleteMessageSeconds) {
    const duration = Duration.fromObject({ seconds: deleteMessageSeconds })
    const since = DateTime.fromJSDate(timestamp).minus(duration).toJSDate()
    embed.addFields({
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
    embed.addFields({
      name: "🕑 Will be unmuted",
      value: `${time(
        targetMember.communicationDisabledUntil,
        TimestampStyles.RelativeTime,
      )} (${shiftDuration(Duration.fromMillis(timeout)).toHuman()})`,
    })
  }

  if (action === "untimeout" && timedOutUntil) {
    embed.addFields({
      name: "🕑 Timeout amount skipped",
      value: formatDuration(
        DateTime.fromJSDate(timedOutUntil).diffNow().shiftToAll(),
      ),
    })
  }

  embed.addFields(
    { name: "👤 User", value: targetUser.toString(), inline: true },
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
    embed.addFields({ name: "⚠️ Notice", value: notice.join("\n") })
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
    embeds: [embed],
    components,
  }
}
