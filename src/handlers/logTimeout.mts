/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { Drizzle } from "../clients.mjs"
import { modMenuLogFromDb } from "../messages/modMenuLog.mjs"
import { Config } from "../models/config.mjs"
import { handler } from "../models/handler.mjs"
import { actionsTable, actionLogsTable } from "../schema.mjs"
import { fetchChannel } from "../util/discord.mjs"
import {
  AuditLogChange,
  AuditLogEvent,
  ChannelType,
  GuildMember,
} from "discord.js"
import { DateTime } from "luxon"

async function getAuditLogEntry(member: GuildMember) {
  const auditLogs = await member.guild.fetchAuditLogs({
    type: AuditLogEvent.MemberUpdate,
    limit: 10,
  })

  for (const entry of auditLogs.entries.values()) {
    if (
      entry.target?.id === member.id &&
      entry.changes.some(
        (change) => change.key === "communication_disabled_until",
      )
    ) {
      return entry
    }
  }

  return null
}

export const LogTimeout = handler({
  event: "guildMemberUpdate",
  once: false,
  async handle(_, newMember) {
    if (newMember.user.bot) {
      return
    }

    if (!newMember.communicationDisabledUntil) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 5000))

    const auditLog = await getAuditLogEntry(newMember)
    if (!auditLog) {
      return
    }

    if (!auditLog.executorId) {
      throw new Error(
        `The audit log for the timeout of ${newMember.id} doesn't have an executor`,
      )
    }

    if (auditLog.executorId === newMember.client.user.id) {
      return
    }

    const change = auditLog.changes.find(
      (change): change is AuditLogChange & { new?: string } =>
        change.key === "communication_disabled_until",
    )

    if (!change || !change.new) {
      throw new Error(
        `The audit log for the timeout of ${newMember.id} doesn't contain a change in timeout duration`,
      )
    }

    const [entry] = await Drizzle.insert(actionsTable)
      .values({
        guildId: newMember.guild.id,
        userId: newMember.id,
        action: "timeout",
        dm: false,
        staffId: auditLog.executorId,
        timestamp: auditLog.createdAt,
        dmSuccess: true,
        actionSucess: true,
        timeout:
          Math.floor(
            DateTime.fromISO(change.new)
              .diff(DateTime.fromJSDate(auditLog.createdAt))
              .as("seconds"),
          ) * 1000,
        body: auditLog.reason,
      })
      .returning()

    if (!entry) {
      throw new Error(
        `Couldn't create a log for the timeout of ${newMember.id}`,
      )
    }

    const channel = await fetchChannel(
      newMember.client,
      Config.channels.mod,
      ChannelType.GuildText,
    )
    const message = await channel.send(
      await modMenuLogFromDb(newMember.client, entry),
    )

    await Drizzle.insert(actionLogsTable).values({
      messageId: message.id,
      channelId: channel.id,
      actionId: entry.id,
    })
  },
})
