/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import {
  InstallationContext,
  InteractionContext,
} from "../../models/command.mjs"
import { slashCommand } from "../../models/slashCommand.mjs"
import { ActSubcommand } from "./subcommands/act.mjs"
import { AttachSubcommand } from "./subcommands/attach.mjs"
import { HistorySubcommand } from "./subcommands/history.mjs"
import { MenuSubcommand } from "./subcommands/menu.mjs"
import { RevokeSubcommand } from "./subcommands/revoke.mjs"
import { SendLogSubcommand } from "./subcommands/send-log.mjs"
import { PermissionFlagsBits } from "discord.js"

export const ModCommand = slashCommand({
  name: "mod",
  description: "Commands related to moderation",
  defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,
  contexts: [InteractionContext.Guild],
  integrationTypes: [InstallationContext.GuildInstall],
  nsfw: false,
  subcommands: [
    ActSubcommand,
    AttachSubcommand,
    HistorySubcommand,
    MenuSubcommand,
    RevokeSubcommand,
    SendLogSubcommand,
  ],
})
