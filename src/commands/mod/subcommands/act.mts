/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { Drizzle } from "../../../clients.mjs"
import { ModMenuState } from "../../../messages/modMenu.mjs"
import { modMenuLog } from "../../../messages/modMenuLog.mjs"
import { modMenuSuccess } from "../../../messages/modMenuSuccess.mjs"
import { Colours } from "../../../models/colours.mjs"
import { Config } from "../../../models/config.mjs"
import { slashSubcommand } from "../../../models/slashCommand.mjs"
import { actionLogsTable, insertActionsSchema } from "../../../schema.mjs"
import {
  attachmentsAreImages,
  fetchChannel,
  tryFetchMember,
} from "../../../util/discord.mjs"
import { uploadAttachments } from "../../../util/s3.mjs"
import {
  getPermissions,
  tryAction,
  tryDm,
  tryInsert,
  tryInsertImages,
} from "../shared.mjs"
import { Attachment, ChannelType, EmbedBuilder } from "discord.js"
import { Duration } from "luxon"
import { z } from "zod"

export const ActSubcommand = slashSubcommand({
  name: "act",
  description: "Perform a moderation action without using the moderation menu",
  options: [
    {
      name: "target",
      type: "user",
      description: "Target user",
      required: true,
    },
    {
      name: "action",
      description: "The action to undertake",
      required: true,
      type: "string",
      choices: [
        { name: "Note", value: "note" },
        { name: "Warn", value: "warn" },
        {
          name: "Timeout (1 day)",
          value: `timeout:${Duration.fromObject({ days: 1 }).toMillis()}`,
        },
        {
          name: "Timeout (1 week)",
          value: `timeout:${Duration.fromObject({ weeks: 1 }).toMillis()}`,
        },
        { name: "Kick", value: "kick" },
        { name: "Ban (keep messages)", value: "ban:0" },
        {
          name: "Ban (delete messages)",
          value: `ban:${Duration.fromObject({ days: 7 }).as("seconds")}`,
        },
      ],
    },
    {
      name: "body",
      type: "string",
      required: true,
      description: "The reason/note body",
    },
    {
      name: "dm",
      type: "boolean",
      required: true,
      description:
        "Send a DM to the user; always false for note, always true for warn",
    },
    {
      name: "image1",
      type: "attachment",
      description: "Image to add to the log",
    },
    {
      name: "image2",
      type: "attachment",
      description: "Image to add to the log",
    },
    {
      name: "image3",
      type: "attachment",
      description: "Image to add to the log",
    },
    {
      name: "image4",
      type: "attachment",
      description: "Image to add to the log",
    },
  ],
  async handle(interaction, targetUser, rawAction, body, dm, ...attachments) {
    if (!interaction.inCachedGuild()) {
      return
    }

    const filteredAttachments = attachments.filter(
      (attachment): attachment is Attachment => attachment !== null,
    )
    if (!attachmentsAreImages(filteredAttachments)) {
      await interaction.reply({
        ephemeral: true,
        embeds: [
          new EmbedBuilder()
            .setAuthor({ name: "Invalid attachments" })
            .setDescription(
              "One or more of the supplied attachments isn't a valid image.",
            )
            .setColor(Colours.red[500]),
        ],
      })
      return
    }

    await interaction.deferReply({ ephemeral: true })

    const [actionName, actionExtra] = rawAction.split(":")
    const action = await insertActionsSchema.shape.action.parseAsync(actionName)
    const targetMember = await tryFetchMember(interaction.guild, targetUser)

    const state: ModMenuState = {
      guild: interaction.guild,
      target: targetMember ?? targetUser,
      action,
      body,
      dm,
      staff: interaction.member,
      timestamp: interaction.createdAt,
      timeout: 0,
      deleteMessageSeconds: 0,
    }

    switch (action) {
      case "timeout":
        state.timeout = await z.coerce.number().parseAsync(actionExtra)
        break
      case "ban":
        state.deleteMessageSeconds = await z.coerce
          .number()
          .parseAsync(actionExtra)
        break
      case "note":
        state.dm = false
        break
      case "warn":
        state.dm = true
        break
    }

    // TODO: move this check to tryAction
    const permissions = await getPermissions(
      state.guild,
      interaction.member,
      state.target,
    )
    if (!permissions[action]) {
      await interaction.editReply(
        modMenuSuccess({
          state,
        }),
      )
      return
    }

    let fulfilled
    if (filteredAttachments.length > 0) {
      let rejected
      ;({ fulfilled, rejected } = await uploadAttachments(filteredAttachments))
      if (rejected.length > 0) {
        throw new Error(JSON.stringify(rejected))
      }
    }

    let dmStatus
    let actionStatus
    if (action === "ban" || action === "kick") {
      dmStatus = await tryDm(state)
      actionStatus = await tryAction(state)
    } else {
      actionStatus = await tryAction(state)
      if (actionStatus.success) {
        dmStatus = await tryDm(state)
      } else {
        dmStatus = { success: false, error: "action_failed" as const }
      }
    }

    const insertStatus = await tryInsert({ state, actionStatus, dmStatus })
    let insertImagesStatus = null
    if (insertStatus.success && fulfilled) {
      insertImagesStatus = await tryInsertImages(
        interaction.client,
        insertStatus.id,
        fulfilled.map((entry) => entry.value),
      )
    }

    await interaction.editReply(
      modMenuSuccess({
        state,
        dmStatus,
        actionStatus,
        insertStatus,
        insertImagesStatus,
      }),
    )

    const params: Parameters<typeof modMenuLog>[0] = {
      state,
      dmStatus,
      actionStatus,
      insertStatus,
    }

    if (insertImagesStatus?.success) {
      params.images = insertImagesStatus.data
    }

    for (const channelId of Config.channels.mod) {
      const channel = await fetchChannel(
        interaction.client,
        channelId,
        ChannelType.GuildText,
      )

      if (
        state.guild.id !== channel.guild.id &&
        !channel.guild.members.cache.has(state.target.id)
      ) {
        continue
      }

      const message = await channel.send(modMenuLog(params, channel.guild))
      if (insertStatus.success) {
        await Drizzle.insert(actionLogsTable).values({
          messageId: message.id,
          channelId: message.channelId,
          actionId: insertStatus.id,
        })
      }
    }
  },
})
