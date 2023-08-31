import { Drizzle } from "../../clients.mjs"
import { modHistory } from "../../messages/modHistory.mjs"
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
import { actionsTable, insertActionsSchema } from "../../schema.mjs"
import { fetchChannel, tryFetchMember } from "../../util/discord.mjs"
import { logError } from "../../util/error.mjs"
import { setReasonModal, setBodyModal } from "./modals.mjs"
import {
  ChannelType,
  ComponentType,
  DiscordAPIError,
  Message,
  RESTJSONErrorCodes,
} from "discord.js"
import { Duration } from "luxon"
import type { z } from "zod"

const restrainDuration = Duration.fromObject({
  days: 28,
  minutes: -1,
}).toMillis()

export const openModHistory = staticComponent({
  type: ComponentType.Button,
  name: "mod-history",
  async handle(interaction) {
    if (!interaction.inCachedGuild()) {
      return
    }

    const { targetUser, guild } = await modMenuState(interaction)
    const [firstReply, ...replies] = await modHistory(targetUser, guild)
    if (!firstReply) {
      return
    }

    await interaction.reply(firstReply)
    for (const reply of replies) {
      await interaction.followUp(reply)
    }
  },
})

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

    const targetUser = await interaction.client.users.fetch(userId)
    const state: ModMenuState = {
      guild,
      action: "restrain",
      dm: false,
      timestamp: createdAt,
      targetUser,
      permissions: await getPermissions(guild, targetUser),
      staffMember: member,
    }

    const targetMember = await tryFetchMember(guild, targetUser)
    if (targetMember) {
      state.targetMember = targetMember
      state.permissions = await getPermissions(guild, targetUser, targetMember)
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
  const { targetMember, dm } = state
  if (dm === false) {
    return { success: true }
  }

  if (!targetMember) {
    return { success: false, error: "not_in_server" }
  }

  let message
  try {
    message = await targetMember.send(modMenuDm(state))
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
  targetUser,
  targetMember,
  action,
  timeout,
}: ModMenuState): Promise<ActionStatus> {
  try {
    switch (action) {
      case "kick":
        if (!targetMember) {
          return { success: false, error: "not_in_server" }
        }

        await targetMember.kick()
        break
      case "warn":
        break
      case "timeout":
        if (!timeout) {
          return { success: false, error: "timeout_duration" }
        }

        if (!targetMember) {
          return { success: false, error: "not_in_server" }
        }

        await targetMember.timeout(timeout)
        break
      case "ban":
        await guild.bans.create(targetUser)
        break
      case "note":
        break
      case "restrain":
        if (!targetMember) {
          return { success: false, error: "not_in_server" }
        }

        await targetMember.timeout(restrainDuration)
        break
      case "unban":
        await guild.bans.remove(targetUser)
        return { success: true }
      case "untimeout":
        if (!targetMember) {
          return { success: false, error: "not_in_server" }
        }

        await targetMember.timeout(null)
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
    targetUser,
    action,
    body,
    dm,
    staffMember,
    timeout,
    timestamp,
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
          userId: targetUser.id,
          action,
          body: body ?? null,
          dm,
          staffId: staffMember.id,
          timeout: timeout ?? null,
          timestamp,
          dmSuccess: dmStatus.success,
          actionSucess: actionStatus.success,
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
    const { action, permissions } = state

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

    await logs.send(modMenuLog({ state, dmStatus, actionStatus, insertStatus }))
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
    state.action = value as z.infer<typeof insertActionsSchema>["action"]

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
