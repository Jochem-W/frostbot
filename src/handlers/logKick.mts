import { Drizzle } from "../clients.mjs"
import { modMenuLogFromDb } from "../messages/modMenuLog.mjs"
import { Config } from "../models/config.mjs"
import { handler } from "../models/handler.mjs"
import { actionLogsTable, actionsTable } from "../schema.mjs"
import { fetchChannel } from "../util/discord.mjs"
import {
  AuditLogEvent,
  ChannelType,
  GuildMember,
  PartialGuildMember,
} from "discord.js"

async function getAuditLogEntry(member: GuildMember | PartialGuildMember) {
  const auditLogs = await member.guild.fetchAuditLogs({
    type: AuditLogEvent.MemberKick,
    limit: 10,
  })

  for (const [, entry] of auditLogs.entries) {
    if (entry.target?.id === member.id) {
      return entry
    }
  }

  return null
}

export const LogKick = handler({
  event: "guildMemberRemove",
  once: false,
  async handle(member) {
    if (member.user.bot) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 3000))

    const auditLog = await getAuditLogEntry(member)
    if (!auditLog) {
      return
    }

    if (!auditLog.executorId) {
      throw new Error(
        `The audit log for the kick of ${member.id} doesn't have an executor`,
      )
    }

    if (auditLog.executorId === member.client.user.id) {
      return
    }

    const [entry] = await Drizzle.insert(actionsTable)
      .values({
        guildId: member.guild.id,
        userId: member.id,
        action: "kick",
        dm: false,
        staffId: auditLog.executorId,
        timestamp: auditLog.createdAt,
        dmSuccess: true,
        actionSucess: true,
        body: auditLog.reason,
      })
      .returning()

    if (!entry) {
      throw new Error(`Couldn't create a log for the kick of ${member.id}`)
    }

    const channel = await fetchChannel(
      member.client,
      Config.channels.mod,
      ChannelType.GuildText,
    )
    const message = await channel.send(
      await modMenuLogFromDb(member.client, entry),
    )

    await Drizzle.insert(actionLogsTable).values({
      messageId: message.id,
      channelId: channel.id,
      actionId: entry.id,
    })
  },
})
