/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { Drizzle } from "../clients.mjs"
import { modMenuLogFromDb } from "../messages/modMenuLog.mjs"
import { Config } from "../models/config.mjs"
import { handler } from "../models/handler.mjs"
import { actionLogsTable, actionsTable } from "../schema.mjs"
import { fetchChannel } from "../util/discord.mjs"
import { AuditLogEvent, ChannelType, GuildBan } from "discord.js"

async function getAuditLogEntry(ban: GuildBan) {
  const auditLogs = await ban.guild.fetchAuditLogs({
    type: AuditLogEvent.MemberBanAdd,
    limit: 10,
  })

  for (const entry of auditLogs.entries.values()) {
    if (entry.target?.id === ban.user.id) {
      return entry
    }
  }

  throw new Error(
    `Couldn't find an audit log entry for ban target ${ban.user.id}`,
  )
}

export const LogBans = handler({
  event: "guildBanAdd",
  once: false,
  async handle(ban) {
    if (ban.user.bot) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 3000))

    const auditLog = await getAuditLogEntry(ban)
    if (!auditLog.executorId) {
      throw new Error(
        `The audit log for the ban of ${ban.user.id} doesn't have an executor`,
      )
    }

    if (auditLog.executorId === ban.client.user.id) {
      return
    }

    const [entry] = await Drizzle.insert(actionsTable)
      .values({
        guildId: ban.guild.id,
        userId: ban.user.id,
        action: "ban",
        dm: false,
        staffId: auditLog.executorId,
        timestamp: auditLog.createdAt,
        dmSuccess: true,
        actionSucess: true,
        body: auditLog.reason,
        deleteMessageSeconds: 0,
        timeout: 0,
      })
      .returning()

    if (!entry) {
      throw new Error(`Couldn't create a log for the ban of ${ban.user.id}`)
    }

    for (const channelId of Config.channels.mod) {
      const channel = await fetchChannel(
        ban.client,
        channelId,
        ChannelType.GuildText,
      )

      if (
        ban.guild.id !== channel.guild.id &&
        !channel.guild.members.cache.has(ban.user.id)
      ) {
        continue
      }

      const message = await channel.send(
        await modMenuLogFromDb(ban.client, entry, channel.guild),
      )

      await Drizzle.insert(actionLogsTable).values({
        messageId: message.id,
        channelId,
        actionId: entry.id,
      })
    }
  },
})
