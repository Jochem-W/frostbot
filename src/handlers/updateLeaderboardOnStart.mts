/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { Drizzle } from "../clients.mjs"
import { Config } from "../models/config.mjs"
import { handler } from "../models/handler.mjs"
import { usersTable } from "../schema.mjs"

export const UpdateLeaderboardOnStart = handler({
  event: "ready",
  once: true,
  async handle(client) {
    const guild = await client.guilds.fetch(Config.guild)
    const members = await guild.members.fetch()

    const now = performance.now()

    await Drizzle.transaction(async (transaction) => {
      await transaction.update(usersTable).set({ member: false })

      for (const { user } of members.values()) {
        if (user.bot) {
          continue
        }

        await transaction
          .insert(usersTable)
          .values({
            id: user.id,
            xp: 0,
            name: user.displayName,
            avatar: user.avatar,
            member: true,
            discriminator: user.discriminator,
          })
          .onConflictDoUpdate({
            target: usersTable.id,
            set: {
              name: user.displayName,
              avatar: user.avatar,
              member: true,
              discriminator: user.discriminator,
            },
          })
      }
    })

    console.log("Transaction finished in", performance.now() - now)
  },
})
