import { Drizzle } from "../../clients.mjs"
import {
  getPermissions,
  modMenu,
  modMenuState,
  type ModMenuState,
} from "../../messages/modMenu.mjs"
import { modMenuDm } from "../../messages/modMenuDm.mjs"
import { modMenuLog } from "../../messages/modMenuLog.mjs"
import { modMenuSuccess } from "../../messages/modMenuSuccess.mjs"
import { staticComponent } from "../../models/component.mjs"
import { Config } from "../../models/config.mjs"
import {
  actionLogsTable,
  actionsTable,
  insertActionsSchema,
} from "../../schema.mjs"
import { fetchChannel, tryFetchMember } from "../../util/discord.mjs"
import { logError } from "../../util/error.mjs"
import { setReasonModal, setBodyModal } from "./modals.mjs"
import {
  ChannelType,
  ComponentType,
  DiscordAPIError,
  Message,
  RESTJSONErrorCodes,
  User,
} from "discord.js"
import { Duration } from "luxon"

const restrainDuration = Duration.fromObject({
  days: 28,
  minutes: -1,
}).toMillis()

export const openModMenu = staticComponent({
  type: ComponentType.Button,
  name: "mod-menu",
  async handle(interaction) {
    if (!interaction.inCachedGuild()) {
      return
    }

    const { guild, createdAt, message, member } = interaction

    const userId = message.embeds[0]?.fields.find((field) =>
      field.name.includes("User ID"),
    )?.value
    if (!userId) {
      return
    }

    const target = await interaction.client.users.fetch(userId)
    const state: ModMenuState = {
      guild,
      action: "restrain",
      dm: false,
      timestamp: createdAt,
      target,
      staff: member,
      deleteMessageSeconds: 0,
    }

    const targetMember = await tryFetchMember(guild, target)
    if (targetMember) {
      state.target = targetMember
    }

    await interaction.reply(await modMenu(state))
    await interaction.message.edit({ components: [] })
  },
})

export const toggleDm = staticComponent({
  type: ComponentType.Button,
  name: "mod-dm",
  async handle(interaction) {
    if (!interaction.inCachedGuild()) {
      return
    }

    const state = await modMenuState(interaction)
    state.dm = !state.dm

    await interaction.update(await modMenu(state))
  },
})

export const setReason = staticComponent({
  type: ComponentType.Button,
  name: "mod-body",
  async handle(interaction) {
    if (!interaction.inCachedGuild()) {
      return
    }

    const state = await modMenuState(interaction)

    const defaults: Parameters<typeof setReasonModal>[0] = {}
    if (state.body) {
      defaults.body = state.body
    }

    if (state.action === "note") {
      await interaction.showModal(setBodyModal(defaults))
      return
    }

    await interaction.showModal(setReasonModal(defaults))
  },
})

async function tryDm(state: ModMenuState): Promise<DmStatus> {
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

async function tryAction({
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
        // TODO: check member
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

async function tryInsert({
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

export const confirmAction = staticComponent({
  type: ComponentType.Button,
  name: "mod-confirm",
  async handle(interaction) {
    if (!interaction.inCachedGuild()) {
      return
    }

    const state = await modMenuState(interaction)
    const { guild, target, action } = state

    const permissions = await getPermissions(guild, interaction.member, target)
    if (!permissions[action]) {
      await interaction.update(
        modMenuSuccess({
          state,
        }),
      )
      return
    }

    let dmStatus
    let actionStatus
    if (action === "ban" || action === "kick") {
      dmStatus = await tryDm(state)
      actionStatus = await tryAction(state)
    } else {
      actionStatus = await tryAction(state)
      if (actionStatus.success) {
        dmStatus = await tryDm(state)
      } else {
        dmStatus = { success: false, error: "action_failed" as const }
      }
    }

    const insertStatus = await tryInsert({ state, dmStatus, actionStatus })

    await interaction.update(
      modMenuSuccess({
        state,
        dmStatus,
        actionStatus,
        insertStatus,
      }),
    )

    const logs = await fetchChannel(
      interaction.client,
      Config.channels.mod,
      ChannelType.GuildText,
    )

    const message = await logs.send(
      modMenuLog({ state, dmStatus, actionStatus, insertStatus }),
    )
    if (insertStatus.success) {
      await Drizzle.insert(actionLogsTable).values({
        messageId: message.id,
        channelId: message.channelId,
        actionId: insertStatus.id,
      })
    }
  },
})

export const messageDeleteDropdown = staticComponent({
  type: ComponentType.StringSelect,
  name: "mod-delete",
  async handle(interaction) {
    if (!interaction.inCachedGuild()) {
      return
    }

    const value = interaction.values[0]
    if (!value) {
      return
    }

    const duration = parseInt(value, 10)
    if (isNaN(duration)) {
      return
    }

    const state = await modMenuState(interaction)
    state.deleteMessageSeconds = duration

    await interaction.update(await modMenu(state))
  },
})

export const timeoutDuration = staticComponent({
  type: ComponentType.StringSelect,
  name: "mod-timeout",
  async handle(interaction) {
    if (!interaction.inCachedGuild()) {
      return
    }

    const value = interaction.values[0]
    if (!value) {
      return
    }

    const duration = parseInt(value, 10)
    if (isNaN(duration)) {
      return
    }

    const state = await modMenuState(interaction)
    state.timeout = duration

    await interaction.update(await modMenu(state))
  },
})

export const actionDropdown = staticComponent({
  type: ComponentType.StringSelect,
  name: "mod-action",
  async handle(interaction) {
    if (!interaction.inCachedGuild()) {
      return
    }

    const value = interaction.values[0]
    if (!value) {
      return
    }

    const state = await modMenuState(interaction)
    state.action = await insertActionsSchema.shape.action.parseAsync(value)

    switch (value) {
      case "note":
      case "restrain":
      case "unban":
        state.dm = false
        break
      default:
        state.dm = true
        break
    }

    await interaction.update(await modMenu(state))
  },
})
