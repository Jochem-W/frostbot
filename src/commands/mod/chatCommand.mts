import { slashCommand } from "../../models/slashCommand.mjs"
import { ActSubcommand } from "./subcommands/act.mjs"
import { AttachSubcommand } from "./subcommands/attach.mjs"
import { HistorySubcommand } from "./subcommands/history.mjs"
import { MenuSubcommand } from "./subcommands/menu.mjs"
import { PermissionFlagsBits } from "discord.js"

export const ModCommand = slashCommand({
  name: "mod",
  description: "Commands related to moderation",
  defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,
  dmPermission: false,
  nsfw: false,
  subcommands: [
    ActSubcommand,
    AttachSubcommand,
    HistorySubcommand,
    MenuSubcommand,
  ],
})
