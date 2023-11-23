import { Drizzle } from "../clients.mjs"
import { actionDropdown } from "../commands/mod/components/actionDropdown.mjs"
import { confirmAction } from "../commands/mod/components/confirmAction.mjs"
import { messageDeleteDropdown } from "../commands/mod/components/messageDeleteDropdown.mjs"
import { setReason } from "../commands/mod/components/setReason.mjs"
import { timeoutDuration } from "../commands/mod/components/timeoutDuration.mjs"
import { toggleDm } from "../commands/mod/components/toggleDm.mjs"
import {
  ModMenuPermissions,
  getPermissions,
  messageDeleteOptions,
  timeoutOptions,
} from "../commands/mod/shared.mjs"
import { Colours } from "../models/colours.mjs"
import { actionsTable } from "../schema.mjs"
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
  StringSelectMenuOptionBuilder,
  bold,
  italic,
  userMention,
  strikethrough,
  escapeStrikethrough,
} from "discord.js"
import { and, desc, eq, sql } from "drizzle-orm"

const bodyLength = 75

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
    .where(
      and(eq(actionsTable.userId, target.id), eq(actionsTable.hidden, false)),
    )
    .orderBy(desc(actionsTable.timestamp))
    .limit(5)
  const [countData] = await Drizzle.select({
    count: sql<string>`count (*)`,
  })
    .from(actionsTable)
    .where(
      and(eq(actionsTable.userId, target.id), eq(actionsTable.hidden, false)),
    )

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

function actionControls(state: ModMenuState, permissions: ModMenuPermissions) {
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
      text += ", or don't send a DM"
    }

    errors.push(text)
  }

  if (action === "timeout" && !timeout) {
    errors.push(`- Please select a timeout duration.`)
  }

  if (errors.length > 0) {
    errors.unshift("To perform this action:")
    embed.setDescription(errors.join("\n"))
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
  { action, timestamp, body, revoked }: typeof actionsTable.$inferSelect,
) {
  let line = `${bold(formatActionForEntrySummary(action))} ${time(
    timestamp,
    TimestampStyles.RelativeTime,
  )} by ${userMention(staff.id)}`
  if (revoked) {
    line = `${strikethrough(escapeStrikethrough(line))} [Revoked]`
  }

  line = `- ${line}`

  if (!body) {
    return `- ${line}`
  }

  if (body.length <= bodyLength) {
    let appendBody: string = italic(body)
    if (revoked) {
      appendBody = strikethrough(escapeStrikethrough(body))
    }

    line += `\n - ${appendBody}`
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
