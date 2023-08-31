import { Drizzle } from "../clients.mjs"
import {
  setReason,
  toggleDm,
  confirmAction,
  actionDropdown,
  timeoutDuration,
  openModHistory,
} from "../commands/mod/components.mjs"
import { timeoutOptions } from "../commands/mod/shared.mjs"
import { Colours } from "../models/colours.mjs"
import {
  actionsTable,
  selectActionsSchema,
  type insertActionsSchema,
} from "../schema.mjs"
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
  PermissionFlagsBits,
  bold,
  italic,
} from "discord.js"
import { desc, eq, sql } from "drizzle-orm"
import type { Duration } from "luxon"
import type { z } from "zod"

type Permissions = Record<
  z.infer<typeof insertActionsSchema>["action"],
  boolean
>

export function formatDuration(duration: Duration) {
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
    throw new Error() // TODO
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

export async function getPermissions(
  guild: ModMenuState["guild"],
  targetUser: ModMenuState["targetUser"],
  targetMember?: ModMenuState["targetMember"],
) {
  const permissions: Permissions = {
    unban: false,
    kick: false,
    warn: false,
    timeout: false,
    ban: false,
    note: false,
    restrain: false,
    untimeout: false,
  }

  let ban
  try {
    ban = await guild.bans.fetch(targetUser)
    const me = await guild.members.fetchMe()
    permissions.unban = me.permissions.has(PermissionFlagsBits.BanMembers)
  } catch (e) {
    if (
      !(e instanceof DiscordAPIError) ||
      e.code !== RESTJSONErrorCodes.UnknownBan
    ) {
      console.error("Unexpected error when trying to fetch a ban", e)
    }
  }

  if (targetMember?.kickable) {
    permissions.kick = true
  }

  if (targetMember) {
    permissions.warn = true
  }

  if (targetMember?.moderatable) {
    permissions.timeout = true
    permissions.restrain = true
    if (targetMember.isCommunicationDisabled()) {
      permissions.untimeout = true
    }
  }

  if (targetMember?.bannable || (!targetMember && !ban)) {
    permissions.ban = true
  }

  permissions.note = true

  return permissions
}

export type ModMenuState = {
  guild: Guild
  targetUser: User
  targetMember?: GuildMember
  action: z.infer<typeof insertActionsSchema>["action"]
  body?: string
  dm: boolean
  staffMember: GuildMember
  timeout?: number
  permissions: Permissions
  timestamp: Date
  timedOutUntil?: Date
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
    throw new Error()
  }

  const targetUser = await message.client.users.fetch(userId)
  const { guild } = message

  const state: ModMenuState = {
    guild,
    targetUser,
    dm: false,
    staffMember: member,
    action: "restrain",
    permissions: await getPermissions(guild, targetUser),
    timestamp: createdAt,
  }

  const targetMember = await tryFetchMember(state.guild, state.targetUser)
  if (targetMember) {
    state.targetMember = targetMember
    state.permissions = await getPermissions(guild, targetUser, targetMember)

    if (targetMember.communicationDisabledUntil) {
      state.timedOutUntil = targetMember.communicationDisabledUntil
    }
  }

  const components = message.components.map((row) => row.components).flat()

  const option = components
    .find(
      (component): component is StringSelectMenuComponent =>
        component.type === ComponentType.StringSelect,
    )
    ?.options.find((option) => option.default)?.value

  if (option) {
    state.action = option as z.infer<typeof insertActionsSchema>["action"]
  }

  const reason = message.embeds[2]?.fields[0]?.value
  if (reason) {
    state.body = reason
  }

  const dm = components.find(
    (component): component is ButtonComponent =>
      component.type === ComponentType.Button &&
      (component.style === ButtonStyle.Danger ||
        component.style === ButtonStyle.Success),
  )
  if (dm) {
    state.dm = dm.style === ButtonStyle.Success
  }

  const timeout = components
    .find(
      (component): component is StringSelectMenuComponent =>
        component.type === ComponentType.StringSelect &&
        component.customId.includes("timeout"),
    )
    ?.options.find((option) => option.default)

  if (timeout) {
    state.timeout = parseInt(timeout.value, 10)
  }

  return state
}

function formatAction({ action, targetUser, timeout }: ModMenuState) {
  const components = []
  let title
  let postfix = false
  switch (action) {
    case "restrain":
    case "unban":
    case "kick":
    case "warn":
    case "ban":
      title = action[0]?.toUpperCase() + action.slice(1)
      postfix = true
      components.push(
        new ActionRowBuilder<MessageActionRowComponentBuilder>().setComponents(
          new ButtonBuilder()
            .setLabel("Deleting last messages")
            .setStyle(ButtonStyle.Success)
            .setCustomId("abab"),
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

function actionMessage(state: ModMenuState) {
  const { action, body, dm, timeout } = state
  const components = []

  if (action === "restrain") {
    if (state.permissions.restrain) {
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

  const actionData = formatAction(state)
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
          .setDisabled(
            (action === "timeout" && !timeout) ||
              ((dm || action === "note") && !body),
          ),
      ),
    ],
  }
}

function summary(guild: Guild, user: User, member?: GuildMember | null) {
  if (!member) {
    return `Currently, ${user.toString()} isn't in ${
      guild.name
    }. They created their account ${time(
      user.createdAt,
      TimestampStyles.RelativeTime,
    )}.`
  }

  return `Currently, ${user.toString()} is in ${
    guild.name
  }. They created their account ${time(
    user.createdAt,
    TimestampStyles.RelativeTime,
  )} and joined ${guild.name} ${
    member.joinedAt
      ? time(member.joinedAt, TimestampStyles.RelativeTime)
      : "at an unknown time"
  }.`
}

function formatActionForSummary(
  action: z.infer<typeof selectActionsSchema>["action"],
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

const bodyLength = 75

function entrySummary(
  { staffMember }: ModMenuState,
  { action, timestamp, body }: z.infer<typeof selectActionsSchema>,
) {
  let line = `- ${bold(formatActionForSummary(action))} ${time(
    timestamp,
    TimestampStyles.RelativeTime,
  )} by ${staffMember.user.toString()}`
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

export async function modMenu(state: ModMenuState) {
  const { guild, targetUser, targetMember, action, permissions } = state

  const actionData = actionMessage(state)

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
    .where(eq(actionsTable.userId, targetUser.id))
    .orderBy(desc(actionsTable.timestamp))
    .limit(5)
  const [countData] = await Drizzle.select({
    count: sql<string>`count (*)`,
  })
    .from(actionsTable)
    .where(eq(actionsTable.userId, targetUser.id))

  const count = countData?.count ? BigInt(countData.count) : null

  let description
  if (count === null) {
    description = "Unable to fetch user's history."
  } else if (count === 0n) {
    description = "🧼 This user is clean!"
  } else {
    const lines = history.map((entry) => entrySummary(state, entry))
    const otherCount = count - 5n
    if (otherCount !== 0n) {
      lines.push(
        `- And ${bold(otherCount.toString(10))} other log${
          otherCount === 1n ? "" : "s"
        }…`,
      )
    }

    description = lines.join("\n")
  }

  return {
    embeds: [
      new EmbedBuilder()
        .setAuthor({
          name: `Moderating ${targetUser.displayName}`,
          iconURL: targetUser.displayAvatarURL(),
        })
        .setFields({
          name: "Quick summary",
          value: summary(guild, targetUser, targetMember),
        })
        .setColor(Colours.cyan[200])
        .setFooter({ text: targetUser.id }),
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
      new ActionRowBuilder<MessageActionRowComponentBuilder>().setComponents(
        new ButtonBuilder()
          .setLabel("View full history")
          .setCustomId(openModHistory)
          .setStyle(ButtonStyle.Secondary),
      ),
    ],
    ephemeral: true,
  }
}
