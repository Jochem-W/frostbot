import { Drizzle } from "../clients.mjs"
import { slashCommand, slashOption } from "../models/slashCommand.mjs"
import { usersTable } from "../schema.mjs"
import {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandIntegerOption,
  SlashCommandUserOption,
  userMention,
} from "discord.js"
import { eq } from "drizzle-orm"

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
    const [result] = await Drizzle.update(usersTable)
      .set({ xp })
      .where(eq(usersTable.id, user.id))
      .returning()
    if (!result) {
      await Drizzle.insert(usersTable).values({ id: user.id, xp })
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
