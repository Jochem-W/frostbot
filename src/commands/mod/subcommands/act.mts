import { Drizzle } from "../../../clients.mjs"
import { ModMenuState } from "../../../messages/modMenu.mjs"
import { modMenuLog } from "../../../messages/modMenuLog.mjs"
import { modMenuSuccess } from "../../../messages/modMenuSuccess.mjs"
import { Config } from "../../../models/config.mjs"
import { slashOption, subcommand } from "../../../models/slashCommand.mjs"
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
import {
  Attachment,
  ChannelType,
  SlashCommandAttachmentOption,
  SlashCommandBooleanOption,
  SlashCommandStringOption,
  SlashCommandUserOption,
} from "discord.js"
import { Duration } from "luxon"
import { z } from "zod"

export const ActSubcommand = subcommand({
  name: "act",
  description: "Perform a moderation action without using the moderation menu",
  options: [
    slashOption(
      true,
      new SlashCommandUserOption()
        .setName("target")
        .setDescription("Target user"),
    ),
    slashOption(
      true,
      new SlashCommandStringOption()
        .setName("action")
        .setDescription("The action to undertake")
        .setChoices(
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
        ),
    ),
    slashOption(
      true,
      new SlashCommandStringOption()
        .setName("body")
        .setDescription("The reason/note body"),
    ),
    slashOption(
      true,
      new SlashCommandBooleanOption()
        .setName("dm")
        .setDescription(
          "Send a DM to the user; always false for note, always true for warn",
        ),
    ),
    slashOption(
      false,
      new SlashCommandAttachmentOption()
        .setName("image1")
        .setDescription("Image to add to the log"),
    ),
    slashOption(
      false,
      new SlashCommandAttachmentOption()
        .setName("image2")
        .setDescription("Image to add to the log"),
    ),
    slashOption(
      false,
      new SlashCommandAttachmentOption()
        .setName("image3")
        .setDescription("Image to add to the log"),
    ),
    slashOption(
      false,
      new SlashCommandAttachmentOption()
        .setName("image4")
        .setDescription("Image to add to the log"),
    ),
  ],
  async handle(interaction, targetUser, rawAction, body, dm, ...attachments) {
    if (!interaction.inCachedGuild()) {
      return
    }

    const filteredAttachments = attachments.filter(
      (attachment): attachment is Attachment => attachment !== null,
    )
    if (!attachmentsAreImages(filteredAttachments)) {
      throw new Error("Some of the attachments aren't valid images")
    }

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
      await interaction.reply(
        modMenuSuccess({
          state,
        }),
      )
      return
    }

    let fulfilled
    if (filteredAttachments.length > 0) {
      await interaction.deferReply()
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
    let insertImagesStatus
    if (insertStatus.success && fulfilled) {
      insertImagesStatus = await tryInsertImages(
        interaction.client,
        insertStatus.id,
        fulfilled.map((entry) => entry.value),
      )
    }

    await interaction.reply(
      modMenuSuccess({
        state,
        dmStatus,
        actionStatus,
        insertStatus,
        insertImagesStatus,
      }),
    )

    const channel = await fetchChannel(
      interaction.client,
      Config.channels.mod,
      ChannelType.GuildText,
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

    const message = await channel.send(modMenuLog(params))
    if (insertStatus.success) {
      await Drizzle.insert(actionLogsTable).values({
        messageId: message.id,
        channelId: message.channelId,
        actionId: insertStatus.id,
      })
    }
  },
})
