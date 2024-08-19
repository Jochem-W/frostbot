import { Colours } from "../models/colours.mjs"
import { InstallationContext, InteractionContext } from "../models/command.mjs"
import { component } from "../models/component.mjs"
import { slashCommand } from "../models/slashCommand.mjs"
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  type MessageActionRowComponentBuilder,
} from "discord.js"
import gm from "gm"
import { z } from "zod"

const url = "http://colormind.io/api/"
const responseModel = z.object({
  result: z.tuple([
    z.tuple([z.number(), z.number(), z.number()]),
    z.tuple([z.number(), z.number(), z.number()]),
    z.tuple([z.number(), z.number(), z.number()]),
    z.tuple([z.number(), z.number(), z.number()]),
    z.tuple([z.number(), z.number(), z.number()]),
  ]),
})

const size = 100

const regenerate = component({
  type: ComponentType.Button,
  name: "palette",
  async handle(interaction) {
    await interaction.update(await generate())
  },
})

async function generate() {
  const response = await fetch(url, {
    method: "POST",
    body: '{"model":"default"}',
    headers: { "Content-Type": "application/json" },
  })
  if (!response.ok) {
    return {
      embeds: [
        new EmbedBuilder()
          .setTitle("Error while generating palette")
          .setDescription(
            "An error occurred while generating the color palette. Please try again later!",
          )
          .setColor(Colours.red[500]),
      ],
      ephemeral: true,
    }
  }

  const { result } = await responseModel.parseAsync(await response.json())

  const image = gm.subClass({ imageMagick: "7+" })(
    result.length * size,
    size,
    "#000000",
  )

  const colours = result.map(
    (arr) => `#${arr.map((num) => num.toString(16).padStart(2, "0")).join("")}`,
  )

  let offset = 0
  for (const colour of colours) {
    image.fill(colour).drawRectangle(offset, 0, offset + size, size)
    offset += size
  }

  return {
    ephemeral: true,
    components: [
      new ActionRowBuilder<MessageActionRowComponentBuilder>().setComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Secondary)
          .setLabel("Regenerate")
          .setEmoji("🎨")
          .setCustomId(regenerate()),
      ),
    ],
    embeds: [
      new EmbedBuilder()
        .setTitle("Here's your random palette!")
        .setImage("attachment://palette.png")
        .setFooter({ text: "colormind.io" })
        .setTimestamp(Date.now()),
    ],
    files: [
      new AttachmentBuilder(image.stream("png"), {
        name: "palette.png",
        description: colours.join(", "),
      }),
    ],
  }
}

export const PaletteCommand = slashCommand({
  name: "palette",
  description: "Generate a random color palette",
  defaultMemberPermissions: null,
  contexts: [InteractionContext.Guild],
  integrationTypes: [InstallationContext.GuildInstall],
  nsfw: false,
  async handle(interaction) {
    await interaction.reply(await generate())
  },
})
