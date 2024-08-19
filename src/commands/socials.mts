import { InstallationContext, InteractionContext } from "../models/command.mjs"
import { slashCommand } from "../models/slashCommand.mjs"
import {
  ActionRowBuilder,
  APIEmoji,
  APIMessageComponentEmoji,
  ButtonBuilder,
  ButtonStyle,
  ComponentEmojiResolvable,
  EmbedBuilder,
  type MessageActionRowComponentBuilder,
} from "discord.js"

const emojis = new Map<string, APIEmoji>()

function componentEmoji(emoji?: APIEmoji): ComponentEmojiResolvable {
  if (!emoji) {
    return "❓"
  }

  const value: APIMessageComponentEmoji = {}
  if (emoji.id) {
    value.id = emoji.id
  }

  if (emoji.name) {
    value.name = emoji.name
  }

  if (emoji.animated) {
    value.animated = emoji.animated
  }

  return value
}

export const SocialsCommand = slashCommand({
  name: "socials",
  description: "Display Lemon's socials",
  defaultMemberPermissions: null,
  contexts: [InteractionContext.Guild],
  integrationTypes: [InstallationContext.GuildInstall],
  nsfw: false,
  async handle(interaction) {
    if (emojis.size === 0) {
      const { items } = (await interaction.client.rest.get(
        `/applications/${interaction.client.application.id}/emojis`,
      )) as { items: APIEmoji[] }
      for (const emoji of items) {
        if (!emoji.name) {
          continue
        }

        emojis.set(emoji.name, emoji)
      }
    }

    await interaction.reply({
      ephemeral: true,
      embeds: [
        new EmbedBuilder().setTitle(
          "Here are my socials and Patreon for when you'd like to further support me and my work!",
        ),
      ],
      components: [
        new ActionRowBuilder<MessageActionRowComponentBuilder>().setComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel("Patreon")
            .setEmoji(componentEmoji(emojis.get("patreon")))
            .setURL("https://www.patreon.com/zestylemonss"),
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel("Twitter")
            .setEmoji(componentEmoji(emojis.get("twitter")))
            .setURL("https://x.com/ZestyLemonss"),
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel("Twitter (alt)")
            .setEmoji(componentEmoji(emojis.get("twitter")))
            .setURL("https://x.com/realcatirl"),
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel("Toyhouse")
            .setEmoji(componentEmoji(emojis.get("toyhouse")))
            .setURL("https://toyhou.se/zestylemons"),
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel("Bluesky")
            .setEmoji(componentEmoji(emojis.get("bluesky")))
            .setURL("https://bsky.app/profile/zestylemonss.bsky.social"),
        ),
      ],
    })
  },
})
