import { handler } from "../models/handler.mjs"
import { Timeouts } from "./joinRole.mjs"

export const CancelJoinRoleHandler = handler({
  event: "guildMemberRemove",
  once: false,
  handle(member) {
    clearTimeout(Timeouts.get(member.id))
    Timeouts.delete(member.id)
  },
})
