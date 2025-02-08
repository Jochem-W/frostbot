import { Colours } from "../../models/colours.mjs"
import { Config } from "../../models/config.mjs"
import { handler } from "../../models/handler.mjs"
import { concatenate, fetchChannel } from "../../util/discord.mjs"
import {
  ChannelType,
  EmbedBuilder,
  TextChannel,
  channelMention,
  userMention,
} from "discord.js"

let logChannel: TextChannel | undefined

export const VoiceStateUpdate = handler({
  event: "voiceStateUpdate",
  once: false,
  async handle(oldState, newState) {
    if (!Config.channels.logs) {
      return
    }

    logChannel ??= await fetchChannel(
      newState.client,
      Config.channels.logs,
      ChannelType.GuildText,
    )

    const member = newState.member
    if (!member) {
      return
    }

    const embeds = [
      new EmbedBuilder()
        .setAuthor({
          name: member.displayName,
          iconURL: member.displayAvatarURL({ size: 4096 }),
        })
        .setTitle("Voice state changed")
        .setTimestamp(Date.now())
        .setColor(Colours.amber[500]),
    ]

    let voiceChannelId = newState.channelId
    if (!oldState.channelId && newState.channelId) {
      embeds.push(
        new EmbedBuilder()
          .setTitle("➡️ Joined a voice channel")
          .setDescription(channelMention(newState.channelId))
          .setColor(Colours.green[500]),
      )
    } else if (oldState.channelId && !newState.channelId) {
      embeds.push(
        new EmbedBuilder()
          .setTitle("⬅️ Left a voice channel")
          .setDescription(channelMention(oldState.channelId))
          .setColor(Colours.red[500]),
      )
      voiceChannelId = oldState.channelId
    } else if (
      oldState.channelId &&
      newState.channelId &&
      oldState.channelId !== newState.channelId
    ) {
      embeds.push(
        new EmbedBuilder()
          .setTitle("↔️ Switched between voice channels")
          .setFields(
            {
              name: "Before",
              value: channelMention(oldState.channelId),
              inline: true,
            },
            {
              name: "After",
              value: channelMention(newState.channelId),
              inline: true,
            },
          )
          .setColor(Colours.amber[500]),
      )
    }

    if (oldState.selfDeaf !== null && oldState.selfDeaf !== newState.selfDeaf) {
      embeds.push(
        new EmbedBuilder()
          .setTitle(`${newState.selfDeaf ? "🔇 D" : "🔊 Und"}eafened`)
          .setColor(Colours.amber[500]),
      )
    }

    if (oldState.selfMute !== null && oldState.selfMute !== newState.selfMute) {
      embeds.push(
        new EmbedBuilder()
          .setTitle(`🎙️ ${newState.selfMute ? "M" : "Unm"}uted`)
          .setColor(Colours.amber[500]),
      )
    }

    if (
      oldState.selfVideo !== null &&
      oldState.selfVideo !== newState.selfVideo
    ) {
      embeds.push(
        new EmbedBuilder()
          .setTitle(`📷 ${newState.selfVideo ? "En" : "Dis"}abled video`)
          .setColor(Colours.amber[500]),
      )
    }

    if (
      oldState.serverDeaf !== null &&
      oldState.serverDeaf !== newState.serverDeaf
    ) {
      embeds.push(
        new EmbedBuilder()
          .setTitle(`Server ${newState.serverDeaf ? "🔇 " : "🔊 un"}deafened`)
          .setColor(Colours.red[500]),
      )
    }

    if (
      oldState.serverMute !== null &&
      oldState.serverMute !== newState.serverMute
    ) {
      embeds.push(
        new EmbedBuilder()
          .setTitle(`🎙️ Server ${newState.serverMute ? "" : "un"}muted`)
          .setColor(Colours.red[500]),
      )
    }

    if (
      oldState.streaming !== null &&
      oldState.streaming !== newState.streaming
    ) {
      embeds.push(
        new EmbedBuilder()
          .setTitle(
            `🖥️ ${newState.streaming ? "Started" : "Stopped"} streaming`,
          )
          .setColor(Colours.amber[500]),
      )
    }

    const [main, change] = embeds
    if (!change || !main) {
      return
    }

    if (embeds.length === 2) {
      main.setTitle(change.data.title ?? null)
      if (change.data.fields) {
        main.setFields(change.data.fields)
      }

      if (change.data.image) {
        main.setImage(change.data.image.url)
      }

      if (change.data.thumbnail) {
        main.setThumbnail(change.data.thumbnail.url)
      }

      if (change.data.color !== undefined) {
        main.setColor(change.data.color)
      }

      embeds.pop()
    }

    if (voiceChannelId) {
      const voiceChannel = await fetchChannel(newState.client, voiceChannelId, [
        ChannelType.GuildVoice,
        ChannelType.GuildStageVoice,
      ])

      const connected = concatenate(
        voiceChannel.members.values(),
        (item) => `\n- ${userMention(item.id)}`,
        1024,
      )

      main.addFields(
        { name: "Voice channel", value: channelMention(voiceChannelId) },
        {
          name: "Connected members",
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          value: connected || "None",
        },
        { name: "User ID", value: member.id, inline: true },
        { name: "Voice channel ID", value: voiceChannel.id, inline: true },
      )
    }

    await logChannel.send({ embeds })
  },
})
