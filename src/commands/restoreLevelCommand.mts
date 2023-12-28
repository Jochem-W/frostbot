import { Drizzle } from "../clients.mjs"
import { Colours } from "../models/colours.mjs"
import { Config } from "../models/config.mjs"
import { contextMenuCommand } from "../models/contextMenuCommand.mjs"
import { usersTable } from "../schema.mjs"
import { levelForTotalXp, totalXpForLevel } from "../util/xp.mjs"
import {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  DiscordAPIError,
  EmbedBuilder,
  InteractionReplyOptions,
  MessageActionRowComponentBuilder,
  MessageContextMenuCommandInteraction,
  MessageCreateOptions,
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

async function reply(
  interaction: MessageContextMenuCommandInteraction,
  data: InteractionReplyOptions & MessageCreateOptions,
) {
  await interaction.reply(data)
  try {
    await interaction.user.send(data)
  } catch (e) {
    if (
      !(e instanceof DiscordAPIError) ||
      e.code !== RESTJSONErrorCodes.CannotSendMessagesToThisUser
    ) {
      throw e
    }
  }
}

export const RestoreLevelCommand = contextMenuCommand({
  name: "Restore level",
  type: ApplicationCommandType.Message,
  defaultMemberPermissions: null,
  dmPermission: false,
  async handle(interaction, message) {
    if (!interaction.inCachedGuild()) {
      return
    }

    const parsed = await model.safeParseAsync(
      message.embeds[0]?.description?.match(regex)?.groups,
    )

    const components = [
      new ActionRowBuilder<MessageActionRowComponentBuilder>().setComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setEmoji("🔗")
          .setLabel("Go to message")
          .setURL(message.url),
      ),
    ]

    if (!parsed.success) {
      await reply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setTitle("Invalid message")
            .setDescription("This isn't a valid level-up message!")
            .setColor(Colours.red[500]),
        ],
        ephemeral: true,
        components,
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
      await reply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setTitle("Invalid message")
            .setDescription(
              "I wasn't able to verify that this level-up message belongs to you!",
            )
            .setColor(Colours.red[500]),
        ],
        ephemeral: true,
        components,
      })
      return
    }

    const [user] = await Drizzle.select()
      .from(usersTable)
      .where(eq(usersTable.id, interaction.user.id))

    if (user) {
      const currentLevel = levelForTotalXp(user.xp)
      if (currentLevel >= parsedLevel) {
        await reply(interaction, {
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
          components,
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

    await interaction.member.roles.add(
      [...Config.levelRoles.entries()]
        .filter(([level]) => parseInt(level) <= parsedLevel)
        .map(([, roleId]) => roleId)
        .filter((roleId) => !interaction.member.roles.cache.has(roleId)),
    )

    await reply(interaction, {
      ephemeral: true,
      embeds: [
        new EmbedBuilder()
          .setTitle("Level restored")
          .setDescription(
            `Your level was sucessfully restored to ${parsedLevel}!`,
          )
          .setColor(Colours.blue[500]),
      ],
      components,
    })
  },
})
