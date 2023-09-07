import { Drizzle } from "../clients.mjs"
import {
  setReason,
  toggleDm,
  confirmAction,
  actionDropdown,
  timeoutDuration,
  messageDeleteDropdown,
} from "../commands/mod/components.mjs"
import {
  messageDeleteOptions,
  timeoutOptions,
} from "../commands/mod/shared.mjs"
import { Colours } from "../models/colours.mjs"
import { actionsTable, insertActionsSchema } from "../schema.mjs"
import { tryFetchMember } from "../util/discord.mjs"
import {
  EmbedBuilder,
  ActionRowBuilder,
  type MessageActionRowComponentBuilder,
  StringSelectMenuBuilder,
  Guild,
  User,
  GuildMember,
  TimestampStyles,
  time,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  StringSelectMenuComponent,
  ButtonComponent,
  MessageComponentInteraction,
  type ModalMessageModalSubmitInteraction,
  StringSelectMenuOptionBuilder,
  DiscordAPIError,
  RESTJSONErrorCodes,
  bold,
  italic,
  userMention,
} from "discord.js"
import { desc, eq, sql } from "drizzle-orm"
import type { Duration } from "luxon"

const bodyLength = 75

type Permissions = Record<(typeof actionsTable.$inferSelect)["action"], boolean>

export type ModMenuState = {
  guild: Guild
  target: User | GuildMember
  action: (typeof actionsTable.$inferInsert)["action"]
  body?: string
  dm: boolean
  staff: User | GuildMember
  timeout?: number
  timestamp: Date
  timedOutUntil?: Date
  deleteMessageSeconds?: number
}

export async function modMenu(state: ModMenuState) {
  const { guild, target, action, staff } = state
  if (staff instanceof User) {
    throw new Error("Mod menus can only be created for members, not users")
  }

  const permissions = await getPermissions(guild, staff, target)
  const actionData = actionControls(state, permissions)

  const options = []
  if (permissions.kick) {
    options.push(
      new StringSelectMenuOptionBuilder()
        .setEmoji("👢")
        .setLabel("Kick")
        .setDescription("Kick this user from the server.")
        .setValue("kick")
        .setDefault(action === "kick"),
    )
  }

  if (permissions.warn) {
    options.push(
      new StringSelectMenuOptionBuilder()
        .setEmoji("👮")
        .setLabel("Warn")
        .setDescription("Warn this user and attempt to send them a DM.")
        .setValue("warn")
        .setDefault(action === "warn"),
    )
  }

  if (permissions.untimeout) {
    options.push(
      new StringSelectMenuOptionBuilder()
        .setEmoji("🔊")
        .setLabel("Remove timeout")
        .setDescription("Remove this user's timeout.")
        .setValue("untimeout")
        .setDefault(action === "untimeout"),
    )
  }

  if (permissions.timeout) {
    options.push(
      new StringSelectMenuOptionBuilder()
        .setEmoji("🔇")
        .setLabel("Timeout")
        .setDescription("Time this user out.")
        .setValue("timeout")
        .setDefault(action === "timeout"),
    )
  }

  if (permissions.unban) {
    options.push(
      new StringSelectMenuOptionBuilder()
        .setEmoji("✅")
        .setLabel("Unban")
        .setDescription("Remove this user's ban.")
        .setValue("unban")
        .setDefault(action === "unban"),
    )
  }

  if (permissions.ban) {
    options.push(
      new StringSelectMenuOptionBuilder()
        .setEmoji("❌")
        .setLabel("Ban")
        .setDescription("Ban this user from the server.")
        .setValue("ban")
        .setDefault(action === "ban"),
    )
  }

  if (permissions.note) {
    options.push(
      new StringSelectMenuOptionBuilder()
        .setEmoji("📝")
        .setLabel("Note")
        .setDescription("Add a note to this user's history.")
        .setValue("note")
        .setDefault(action === "note"),
    )
  }

  const history = await Drizzle.select()
    .from(actionsTable)
    .where(eq(actionsTable.userId, target.id))
    .orderBy(desc(actionsTable.timestamp))
    .limit(5)
  const [countData] = await Drizzle.select({
    count: sql<string>`count (*)`,
  })
    .from(actionsTable)
    .where(eq(actionsTable.userId, target.id))

  const count = countData?.count ? BigInt(countData.count) : null

  let description
  if (count === null) {
    description = "Unable to fetch user's history."
  } else if (count === 0n) {
    description = "🧼 This user is clean!"
  } else {
    const lines = history.map((entry) => entrySummary(state, entry))
    const otherCount = count - 5n
    if (otherCount > 0n) {
      lines.push(
        `- And ${bold(otherCount.toString(10))} other log${
          otherCount === 1n ? "" : "s"
        }…`,
      )
    }

    description = lines.join("\n")
  }

  const targetUser = target instanceof GuildMember ? target.user : target

  return {
    embeds: [
      new EmbedBuilder()
        .setAuthor({
          name: `Moderating ${targetUser.displayName}`,
          iconURL: targetUser.displayAvatarURL(),
        })
        .setFields({
          name: "Quick summary",
          value: targetSummary(guild, target),
        })
        .setColor(Colours.cyan[200])
        .setFooter({ text: target.id }),
      new EmbedBuilder()
        .setTitle("History")
        .setDescription(description)
        .setColor(Colours.cyan[400]),
      ...actionData.embeds,
    ],
    components: [
      new ActionRowBuilder<MessageActionRowComponentBuilder>().setComponents(
        new StringSelectMenuBuilder()
          .setOptions(options)
          .setCustomId(actionDropdown),
      ),
      ...actionData.components,
    ],
    ephemeral: true,
  }
}

export async function getPermissions(
  guild: Guild,
  staff: GuildMember,
  target: User | GuildMember,
) {
  const permissions: Permissions = {
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

function formatActionAsQuestion({
  action,
  target,
  timeout,
  deleteMessageSeconds,
}: ModMenuState) {
  const targetUser = target instanceof GuildMember ? target.user : target

  const components = []
  let title
  let postfix = false
  switch (action) {
    case "restrain":
    case "unban":
    case "kick":
    case "warn":
      title = action[0]?.toUpperCase() + action.slice(1)
      postfix = true
      break
    case "ban":
      title = action[0]?.toUpperCase() + action.slice(1)
      postfix = true
      components.push(
        new ActionRowBuilder<MessageActionRowComponentBuilder>().setComponents(
          new StringSelectMenuBuilder()
            .setOptions(
              messageDeleteOptions.map((data) =>
                new StringSelectMenuOptionBuilder(data).setDefault(
                  data.value === deleteMessageSeconds?.toString(10),
                ),
              ),
            )
            .setCustomId(messageDeleteDropdown),
        ),
      )
      break
    case "untimeout":
      title = `Remove ${targetUser.displayName}'s timeout?`
      break
    case "timeout":
      title = `Time ${targetUser.displayName} out?`
      components.push(
        new ActionRowBuilder<MessageActionRowComponentBuilder>().setComponents(
          new StringSelectMenuBuilder()
            .setOptions(
              timeoutOptions.map((data) =>
                new StringSelectMenuOptionBuilder(data).setDefault(
                  data.value === timeout?.toString(10),
                ),
              ),
            )
            .setCustomId(timeoutDuration),
        ),
      )
      break
    case "note":
      title = `Add a note to ${targetUser.displayName}'s history?`
      break
  }

  if (postfix) {
    title += ` ${targetUser.displayName}?`
  }

  return { title, components }
}

function actionControls(state: ModMenuState, permissions: Permissions) {
  const { action, body, dm, timeout } = state
  const components = []

  if (action === "restrain") {
    if (permissions.restrain) {
      components.push(
        new ActionRowBuilder<MessageActionRowComponentBuilder>().setComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Primary)
            .setLabel("Restrain user")
            .setCustomId(confirmAction),
        ),
      )
    }

    return {
      embeds: [
        new EmbedBuilder()
          .setDescription("Please select an option.")
          .setColor(Colours.neutral[400]),
      ],
      components,
    }
  }

  const embed = new EmbedBuilder()
    .setFooter({
      text: "Use the select menu below to switch actions.",
    })
    .setColor(Colours.cyan[600])

  if (body) {
    embed.setFields({
      name: action === "note" ? "Body" : "Reason",
      value: body,
    })
  }

  const errors = []
  if ((dm || action === "note") && !body) {
    let text = `- Please set a ${action === "note" ? "body" : "reason"}`
    if (action !== "warn" && action !== "note") {
      text += ", don't send a DM"
    }

    text += ", or choose another option."
    errors.push(text)
  }

  if (action === "timeout" && !timeout) {
    errors.push(`- Please select a timeout duration.`)
  }

  if (errors.length > 0) {
    errors.unshift("To perform this action:")
    embed.addFields({ name: "⚠️ Notice", value: errors.join("\n") })
  }

  const actionData = formatActionAsQuestion(state)
  if (actionData.components) {
    components.push(...actionData.components)
  }

  embed.setTitle(actionData.title)

  return {
    embeds: [embed],
    components: [
      ...components,
      new ActionRowBuilder<MessageActionRowComponentBuilder>().setComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Secondary)
          .setLabel(
            `${body ? "Change" : "Set"} ${
              action === "note" ? "body" : "reason"
            }`,
          )
          .setCustomId(setReason),
        new ButtonBuilder()
          .setLabel(dm ? "Sending a DM" : "Not sending a DM")
          .setStyle(dm ? ButtonStyle.Success : ButtonStyle.Danger)
          .setDisabled(
            action === "warn" || action === "note" || action === "unban",
          )
          .setCustomId(toggleDm),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Primary)
          .setLabel(`Confirm ${action}`)
          .setCustomId(confirmAction)
          .setDisabled(errors.length !== 0),
      ),
    ],
  }
}

function targetSummary(guild: Guild, target: User | GuildMember) {
  if (target instanceof User) {
    return `Currently, ${userMention(target.id)} isn't in ${
      guild.name
    }. They created their account ${time(
      target.createdAt,
      TimestampStyles.RelativeTime,
    )}.`
  }

  return `Currently, ${userMention(target.id)} is in ${
    guild.name
  }. They created their account ${time(
    target.user.createdAt,
    TimestampStyles.RelativeTime,
  )} and joined ${guild.name} ${
    target.joinedAt
      ? time(target.joinedAt, TimestampStyles.RelativeTime)
      : "at an unknown time"
  }.`
}

function formatActionForEntrySummary(
  action: (typeof actionsTable.$inferSelect)["action"],
) {
  switch (action) {
    case "unban":
      return "Unbanned"
    case "kick":
      return "Kicked"
    case "warn":
      return "Warned"
    case "timeout":
      return "Timed out"
    case "ban":
      return "Banned"
    case "note":
      return "Note created"
    case "restrain":
      return "Restrained"
    case "untimeout":
      return "Timeout removed"
  }
}

function entrySummary(
  { staff }: ModMenuState,
  { action, timestamp, body }: typeof actionsTable.$inferSelect,
) {
  let line = `- ${bold(formatActionForEntrySummary(action))} ${time(
    timestamp,
    TimestampStyles.RelativeTime,
  )} by ${userMention(staff.id)}`
  if (!body) {
    return line
  }

  if (body.length <= bodyLength) {
    line += `\n - ${italic(body)}`
    return line
  }

  line += `\n - ${italic(
    body
      .slice(0, bodyLength - 1)
      .replace("\n", " ")
      .trim(),
  )}…`
  return line
}
