import { ModMenuState } from "../../messages/modMenu.mjs"
import { Colours } from "../../models/colours.mjs"
import { actionsTable, insertActionsSchema } from "../../schema.mjs"
import { tryFetchMember } from "../../util/discord.mjs"
import {
  actionDropdown,
  toggleDm,
  timeoutDuration,
  messageDeleteDropdown,
} from "./components.mjs"
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
