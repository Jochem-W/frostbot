/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { Exchange, ProducerChannel, Drizzle } from "../clients.mjs"
import { modMenuLogFromDb } from "../messages/modMenuLog.mjs"
import { handler } from "../models/handler.mjs"
import { actionsTable } from "../schema.mjs"
import { AmpqMessage } from "./rabbit.mjs"
import { AuditLogEvent, GuildMember, PartialGuildMember } from "discord.js"

async function getAuditLogEntry(member: GuildMember | PartialGuildMember) {
  const auditLogs = await member.guild.fetchAuditLogs({
    type: AuditLogEvent.MemberKick,
    limit: 10,
  })

  for (const entry of auditLogs.entries.values()) {
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
        deleteMessageSeconds: 0,
        timeout: 0,
      })
      .returning()

    if (!entry) {
      throw new Error(`Couldn't create a log for the kick of ${member.id}`)
    }

    const log = await modMenuLogFromDb(member.client, entry)
    const ampqMessage: AmpqMessage = {
      type: "create",
      guild: {
        id: member.guild.id,
        name: member.guild.name,
      },
      target: entry.userId,
      content: {
        embeds: log.embeds.map((e) => e.toJSON()),
        components: log.components.map((c) => c.toJSON()),
      },
      id: entry.id,
    }

    ProducerChannel.publish(
      Exchange,
      "",
      Buffer.from(JSON.stringify(ampqMessage)),
    )
  },
})
