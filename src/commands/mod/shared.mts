import { Drizzle } from "../../clients.mjs"
import { ModMenuState } from "../../messages/modMenu.mjs"
import { modMenuDm } from "../../messages/modMenuDm.mjs"
import { Colours } from "../../models/colours.mjs"
import { actionsTable, insertActionsSchema } from "../../schema.mjs"
import { tryFetchMember } from "../../util/discord.mjs"
import { logError } from "../../util/error.mjs"
import { actionDropdown } from "./components/actionDropdown.mjs"
import { messageDeleteDropdown } from "./components/messageDeleteDropdown.mjs"
import { timeoutDuration } from "./components/timeoutDuration.mjs"
import { toggleDm } from "./components/toggleDm.mjs"
import {
  ButtonComponent,
  ButtonStyle,
  ComponentType,
  DiscordAPIError,
  Guild,
  GuildMember,
  MessageComponentInteraction,
  ModalMessageModalSubmitInteraction,
  RESTJSONErrorCodes,
  StringSelectMenuComponent,
  User,
  type SelectMenuComponentOptionData,
  Message,
} from "discord.js"
import { Duration } from "luxon"

export type ModMenuPermissions = Record<
  (typeof actionsTable.$inferSelect)["action"],
  boolean
>

export const timeoutOptions: SelectMenuComponentOptionData[] = [
  {
    label: "1 day",
    value: Duration.fromObject({ days: 1 }).toMillis().toString(10),
  },
  {
    label: "1 week",
    value: Duration.fromObject({ weeks: 1 }).toMillis().toString(10),
  },
]

export const messageDeleteOptions: SelectMenuComponentOptionData[] = [
  {
    label: "Don't delete any messages",
    emoji: "🗑️",
    value: "0",
  },
  {
    label: "Delete the previous hour of messages",
    emoji: "🕐",
    value: Duration.fromObject({ hours: 1 }).as("seconds").toString(10),
  },
  {
    label: "Delete the previous 6 hours of messages",
    emoji: "🕕",
    value: Duration.fromObject({ hours: 6 }).as("seconds").toString(10),
  },
  {
    label: "Delete the previous 12 hours of messages",
    emoji: "🕛",
    value: Duration.fromObject({ hours: 12 }).as("seconds").toString(10),
  },
  {
    label: "Delete the previous 24 hours of messages",
    emoji: "🕛",
    value: Duration.fromObject({ hours: 24 }).as("seconds").toString(10),
  },
  {
    label: "Delete the previous 3 days of messages",
    emoji: "📅",
    value: Duration.fromObject({ days: 3 }).as("seconds").toString(10),
  },
  {
    label: "Delete the previous 7 days of messages",
    emoji: "📅",
    value: Duration.fromObject({ days: 7 }).as("seconds").toString(10),
  },
]

export async function getPermissions(
  guild: Guild,
  staff: GuildMember,
  target: User | GuildMember,
) {
  const permissions: ModMenuPermissions = {
    unban: false,
    kick: false,
    warn: false,
    timeout: false,
    ban: false,
    note: true,
    restrain: false,
    untimeout: false,
  }

  const me = await guild.members.fetchMe()

  let ban
  try {
    ban = await guild.bans.fetch(target)
    permissions.unban =
      me.permissions.has("BanMembers") && staff.permissions.has("BanMembers")
  } catch (e) {
    if (
      !(e instanceof DiscordAPIError) ||
      e.code !== RESTJSONErrorCodes.UnknownBan
    ) {
      console.error("Unexpected error when trying to fetch a ban", e)
    }
  }

  if (target instanceof User) {
    permissions.ban =
      !ban &&
      staff.permissions.has("BanMembers") &&
      me.permissions.has("BanMembers")
    return permissions
  }

  permissions.warn = true

  if (staff.roles.highest.comparePositionTo(target.roles.highest) <= 0) {
    return permissions
  }

  permissions.kick = target.kickable && staff.permissions.has("KickMembers")

  permissions.timeout =
    target.moderatable && staff.permissions.has("ModerateMembers")
  permissions.restrain = permissions.timeout
  permissions.untimeout =
    permissions.timeout && target.isCommunicationDisabled()

  permissions.ban = target.bannable && staff.permissions.has("BanMembers")

  return permissions
}

export async function modMenuState({
  message,
  member,
  createdAt,
}:
  | MessageComponentInteraction<"cached">
  | ModalMessageModalSubmitInteraction<"cached">) {
  const userId = message.embeds[0]?.footer?.text
  if (!userId) {
    throw new Error("Invalid mod menu: no user ID")
  }

  const target = await message.client.users.fetch(userId)
  const { guild } = message

  const state: ModMenuState = {
    guild,
    target,
    action: "restrain",
    dm: false,
    staff: member,
    timestamp: createdAt,
    deleteMessageSeconds: 0,
  }

  const targetMember = await tryFetchMember(guild, target)
  if (targetMember) {
    state.target = targetMember

    if (targetMember.communicationDisabledUntil) {
      state.timedOutUntil = targetMember.communicationDisabledUntil
    }
  }

  const components = message.components.map((row) => row.components).flat()

  const action = components
    .find(
      (component): component is StringSelectMenuComponent =>
        component.type === ComponentType.StringSelect &&
        component.customId === actionDropdown,
    )
    ?.options.find((option) => option.default)?.value

  if (action) {
    state.action = await insertActionsSchema.shape.action.parseAsync(action)
  }

  const reason = message.embeds[2]?.fields.find(
    (field) => field.name === "Reason" || field.name === "Body",
  )?.value
  if (reason) {
    state.body = reason
  }

  state.dm =
    components.find(
      (component): component is ButtonComponent =>
        component.type === ComponentType.Button &&
        component.customId === toggleDm,
    )?.style === ButtonStyle.Success

  const timeout = components
    .find(
      (component): component is StringSelectMenuComponent =>
        component.type === ComponentType.StringSelect &&
        component.customId === timeoutDuration,
    )
    ?.options.find((option) => option.default)

  if (timeout) {
    state.timeout = parseInt(timeout.value, 10)
  }

  const messageDelete = components
    .find(
      (component): component is StringSelectMenuComponent =>
        component.type === ComponentType.StringSelect &&
        component.customId === messageDeleteDropdown,
    )
    ?.options.find((option) => option.default)

  if (messageDelete) {
    state.deleteMessageSeconds = parseInt(messageDelete.value, 10)
  }

  return state
}

export function formatDurationAsSingleUnit(duration: Duration) {
  let amount
  let unit

  if (duration.years > 0) {
    amount = Math.round(duration.as("years"))
    unit = "year"
  } else if (duration.quarters > 0) {
    amount = Math.round(duration.as("quarters"))
    unit = "quarter"
  } else if (duration.months > 0) {
    amount = Math.round(duration.as("months"))
    unit = "month"
  } else if (duration.weeks > 0) {
    amount = Math.round(duration.as("weeks"))
    unit = "week"
  } else if (duration.days > 0) {
    amount = Math.round(duration.as("days"))
    unit = "day"
  } else if (duration.hours > 0) {
    amount = Math.round(duration.as("hours"))
    unit = "hour"
  } else if (duration.minutes > 0) {
    amount = Math.round(duration.as("minutes"))
    unit = "minute"
  } else if (duration.seconds > 0) {
    amount = Math.round(duration.as("seconds"))
    unit = "second"
  } else if (duration.milliseconds > 0) {
    amount = Math.round(duration.as("milliseconds"))
    unit = "millisecond"
  } else {
    return ""
  }

  return `${amount} ${unit}${amount !== 1 ? "s" : ""}`
}

export function getColour(action: ModMenuState["action"]) {
  switch (action) {
    case "unban":
    case "ban":
      return Colours.red[600]
    case "kick":
    case "timeout":
    case "restrain":
    case "untimeout":
      return Colours.red[500]
    case "warn":
      return Colours.red[400]
    case "note":
      return Colours.red[300]
  }
}

export async function tryDm(state: ModMenuState): Promise<DmStatus> {
  const { target, dm } = state
  if (dm === false) {
    return { success: true }
  }

  if (target instanceof User) {
    return { success: false, error: "not_in_server" }
  }

  let message
  try {
    message = await target.send(modMenuDm(state))
  } catch (e) {
    if (
      e instanceof DiscordAPIError &&
      e.code === RESTJSONErrorCodes.CannotSendMessagesToThisUser
    ) {
      return { success: false, error: "cannot_send" }
    }

    return { success: false, error: "unknown" }
  }

  return { success: true, message }
}

const restrainDuration = Duration.fromObject({
  days: 28,
  minutes: -1,
}).toMillis()

export async function tryAction({
  guild,
  target,
  action,
  timeout,
  deleteMessageSeconds,
}: ModMenuState): Promise<ActionStatus> {
  try {
    switch (action) {
      case "kick":
        if (target instanceof User) {
          return { success: false, error: "not_in_server" }
        }

        await target.kick()
        break
      case "warn":
        break
      case "timeout":
        if (!timeout) {
          return { success: false, error: "timeout_duration" }
        }

        if (target instanceof User) {
          return { success: false, error: "not_in_server" }
        }

        await target.timeout(timeout)
        break
      case "ban":
        await guild.bans.create(target, {
          deleteMessageSeconds: deleteMessageSeconds ?? 0,
        })
        break
      case "note":
        break
      case "restrain":
        if (target instanceof User) {
          return { success: false, error: "not_in_server" }
        }

        await target.timeout(restrainDuration)
        break
      case "unban":
        await guild.bans.remove(target)
        return { success: true }
      case "untimeout":
        if (target instanceof User) {
          return { success: false, error: "not_in_server" }
        }

        await target.timeout(null)
        return { success: true }
      default:
        return { success: false, error: "unhandled" }
    }
  } catch (e) {
    return { success: false, error: "unknown" }
  }

  return { success: true }
}

export async function tryInsert({
  state: {
    guild,
    target,
    action,
    body,
    dm,
    staff,
    timeout,
    timestamp,
    deleteMessageSeconds,
    timedOutUntil,
  },
  dmStatus,
  actionStatus,
}: {
  state: ModMenuState
  dmStatus: DmStatus
  actionStatus: ActionStatus
}): Promise<InsertStatus> {
  let data
  try {
    ;[data] = await Drizzle.insert(actionsTable)
      .values([
        {
          guildId: guild.id,
          userId: target.id,
          action,
          body: body ?? null,
          dm,
          staffId: staff.id,
          timeout: timeout ?? null,
          timestamp,
          dmSuccess: dmStatus.success,
          actionSucess: actionStatus.success,
          deleteMessageSeconds: deleteMessageSeconds ?? null,
          timedOutUntil: action === "untimeout" ? timedOutUntil ?? null : null,
        },
      ])
      .returning({ id: actionsTable.id })
  } catch (error) {
    await logError(guild.client, error)
    return { success: false, error }
  }

  if (data === undefined) {
    return { success: false, error: undefined }
  }

  return { success: true, id: data.id }
}

export type DmStatus =
  | {
      success: false
      error: "not_in_server" | "cannot_send" | "unknown" | "action_failed"
    }
  | { success: true; message?: Message<false> }

export type ActionStatus =
  | {
      success: false
      error: "not_in_server" | "timeout_duration" | "unhandled" | "unknown"
    }
  | { success: true; message?: Message<false> }

export type InsertStatus =
  | {
      success: true
      id: number
    }
  | { success: false; error: unknown }
