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

  for (const [, entry] of auditLogs.entries) {
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
  async handle(oldMember, newMember) {
    if (newMember.user.bot) {
      return
    }

    if (!newMember.communicationDisabledUntil) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 3000))

    const auditLog = await getAuditLogEntry(newMember)
    if (!auditLog) {
      if (!oldMember.partial && !oldMember.communicationDisabledUntil) {
        throw new Error() // TODO
      }

      return
    }

    if (!auditLog.executorId) {
      throw new Error() // TODO
    }

    if (auditLog.executorId === newMember.client.user.id) {
      return
    }

    const change = auditLog.changes.find(
      (change): change is AuditLogChange & { new?: string } =>
        change.key === "communication_disabled_until",
    )

    if (!change || !change.new) {
      throw new Error() // TODO
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
      throw new Error() // TODO
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
