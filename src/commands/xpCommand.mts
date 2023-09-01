import { Drizzle } from "../clients.mjs"
import { slashCommand, slashOption } from "../models/slashCommand.mjs"
import { usersTable } from "../schema.mjs"
import { tryFetchMember } from "../util/discord.mjs"
import {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandIntegerOption,
  SlashCommandUserOption,
  userMention,
} from "discord.js"

export const XpCommand = slashCommand({
  name: "xp",
  description: "Set a user's XP",
  dmPermission: false,
  defaultMemberPermissions: PermissionFlagsBits.Administrator,
  options: [
    slashOption(
      true,
      new SlashCommandUserOption()
        .setName("user")
        .setDescription("Target user"),
    ),
    slashOption(
      true,
      new SlashCommandIntegerOption()
        .setName("value")
        .setDescription("XP value"),
    ),
  ],
  async handle(interaction, user, xp) {
    if (!interaction.inCachedGuild()) {
      return
    }

    const [result] = await Drizzle.insert(usersTable)
      .values({
        id: user.id,
        xp,
        name: user.displayName,
        avatar: user.avatar,
        member: !!(await tryFetchMember(interaction.guild, user)),
        discriminator: user.discriminator,
      })
      .onConflictDoUpdate({ target: usersTable.id, set: { xp } })
      .returning()

    if (!result) {
      return
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder().setDescription(
          `Set ${userMention(user.id)}'s XP to ${xp}`,
        ),
      ],
      ephemeral: true,
    })
  },
})
