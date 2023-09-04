import { Drizzle } from "../clients.mjs"
import { Colours } from "../models/colours.mjs"
import { contextMenuCommand } from "../models/contextMenuCommand.mjs"
import { usersTable } from "../schema.mjs"
import { levelForTotalXp, totalXpForLevel } from "../util/xp.mjs"
import {
  ApplicationCommandType,
  DiscordAPIError,
  EmbedBuilder,
  RESTJSONErrorCodes,
} from "discord.js"
import { eq } from "drizzle-orm"
import { z } from "zod"

const regex =
  /(?:<@(?<user>\d+)> has reached )?(?:Prestige (?<prestige>\d+), )?Level (?:\*\*)?(?<level>\d+)(?:\*\*)?/

const model = z.object({
  prestige: z.coerce.number().or(z.undefined()).default(0),
  level: z.coerce.number(),
  user: z.string().or(z.undefined()),
})

export const RestoreLevelCommand = contextMenuCommand({
  name: "Restore level",
  type: ApplicationCommandType.Message,
  defaultMemberPermissions: null,
  dmPermission: false,
  async handle(interaction, message) {
    const parsed = await model.safeParseAsync(
      message.embeds[0]?.description?.match(regex)?.groups,
    )
    if (!parsed.success) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Invalid message")
            .setDescription(
              "This message doesn't contain a valid level-up message!",
            )
            .setColor(Colours.red[500]),
        ],
        ephemeral: true,
      })
      return
    }

    const { data } = parsed
    const parsedLevel = data.prestige * 100 + data.level

    let reference
    if (message.reference) {
      try {
        reference = await message.fetchReference()
      } catch (e) {
        if (
          !(e instanceof DiscordAPIError) ||
          e.code !== RESTJSONErrorCodes.UnknownMessage
        ) {
          throw e
        }
      }
    }

    if (
      reference?.author.id !== interaction.user.id &&
      data.user !== interaction.user.id
    ) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Invalid message")
            .setDescription(
              "I wasn't able to verify that this level-up message belongs to you!",
            )
            .setColor(Colours.red[500]),
        ],
        ephemeral: true,
      })
      return
    }

    const [user] = await Drizzle.select()
      .from(usersTable)
      .where(eq(usersTable.id, interaction.user.id))

    if (user) {
      const currentLevel = levelForTotalXp(user.xp)
      if (currentLevel >= parsedLevel) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle("Level not restored!")
              .setDescription(
                `Restoring your level from ${
                  currentLevel ?? 0
                } to ${parsedLevel} would've made your total XP go down, or it wouldn't have changed anything!`,
              )
              .setColor(Colours.red[500]),
          ],
          ephemeral: true,
        })
        return
      }
    }

    const xp = totalXpForLevel(parsedLevel)
    await Drizzle.insert(usersTable)
      .values({
        id: interaction.user.id,
        xp,
        name: interaction.user.displayName,
        avatar: interaction.user.avatar,
        discriminator: interaction.user.discriminator,
        member: true,
      })
      .onConflictDoUpdate({ target: usersTable.id, set: { xp } })
      .returning()

    await interaction.reply({
      ephemeral: true,
      embeds: [
        new EmbedBuilder()
          .setTitle("Level restored")
          .setDescription(
            `Your level was sucessfully restored to ${parsedLevel}!`,
          )
          .setColor(Colours.blue[500]),
      ],
    })
  },
})
