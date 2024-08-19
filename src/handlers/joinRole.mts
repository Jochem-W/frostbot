import { Config } from "../models/config.mjs"
import { handler } from "../models/handler.mjs"
import { logError } from "../util/error.mjs"
import { GuildMember } from "discord.js"

export const Timeouts = new Map<string, NodeJS.Timeout>()

export const JoinRoleHandler = handler({
  event: "guildMemberAdd",
  once: false,
  handle(member) {
    for (const [role, delay] of Object.entries(Config.joinRoles)) {
      Timeouts.set(
        member.id,
        setTimeout(
          () =>
            void callback(member, role).catch(
              (e) => void logError(member.client, e),
            ),
          delay,
        ),
      )
    }
  },
})

async function callback(member: GuildMember, role: string) {
  await member.roles.add(role)
}
