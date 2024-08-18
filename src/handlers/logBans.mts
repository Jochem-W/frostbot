/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { Exchange, ProducerChannel, Drizzle } from "../clients.mjs"
import { modMenuLogFromDb } from "../messages/modMenuLog.mjs"
import { handler } from "../models/handler.mjs"
import { actionsTable } from "../schema.mjs"
import { AmpqMessage } from "./rabbit.mjs"
import { AuditLogEvent, GuildBan } from "discord.js"

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

    const log = await modMenuLogFromDb(ban.client, entry)
    const ampqMessage: AmpqMessage = {
      type: "create",
      guild: {
        id: ban.guild.id,
        name: ban.guild.name,
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
