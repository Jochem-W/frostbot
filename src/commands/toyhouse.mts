/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { Drizzle } from "../clients.mjs"
import { InstallationContext, InteractionContext } from "../models/command.mjs"
import { modal, modalInput } from "../models/modal.mjs"
import { slashCommand, slashSubcommand } from "../models/slashCommand.mjs"
import { toyhouseTable } from "../schema.mjs"
import {
  EmbedBuilder,
  inlineCode,
  TextInputBuilder,
  TextInputStyle,
  unorderedList,
} from "discord.js"
import { eq, isNull, sql } from "drizzle-orm"

export const ToyhouseCommmand = slashCommand({
  name: "toyhouse",
  description: "Commands related to Toyhouse",
  defaultMemberPermissions: null,
  contexts: [InteractionContext.Guild],
  integrationTypes: [InstallationContext.GuildInstall],
  nsfw: false,
  subcommandGroups: [
    {
      name: "code",
      description: "Commands related to Toyhouse codes",
      subcommands: [
        slashSubcommand({
          name: "add",
          description: "Add one or more Toyhouse codes to the server database",
          async handle(interaction) {
            await interaction.showModal(addModal())
          },
        }),
        slashSubcommand({
          name: "take",
          description: "Take a Toyhouse invite code",
          async handle(interaction) {
            const result:
              | { type: "error"; error: "already_taken" | "no_codes" }
              | { type: "data"; data: typeof toyhouseTable.$inferSelect } =
              await Drizzle.transaction(async (tx) => {
                await tx.execute(
                  sql`LOCK TABLE ${toyhouseTable} IN ACCESS EXCLUSIVE MODE`,
                )

                const [taken] = await tx
                  .select()
                  .from(toyhouseTable)
                  .where(eq(toyhouseTable.taken, interaction.user.id))

                if (taken) {
                  return { type: "error", error: "already_taken" }
                }

                const [row] = await tx
                  .select()
                  .from(toyhouseTable)
                  .where(isNull(toyhouseTable.taken))
                  .orderBy(sql`random()`)
                  .limit(1)
                  .for("update")

                if (!row) {
                  return { type: "error", error: "no_codes" }
                }

                await tx
                  .update(toyhouseTable)
                  .set({ taken: interaction.user.id })
                  .where(eq(toyhouseTable.code, row.code))

                return { type: "data", data: row }
              })

            if (result.type === "error") {
              if (result.error === "already_taken") {
                await interaction.reply({
                  embeds: [
                    new EmbedBuilder()
                      .setTitle("Code limit reached")
                      .setDescription(
                        "Toyhouse invite codes are limited to one per person, and you've previously taken a Toyhouse invite code.",
                      ),
                  ],
                  ephemeral: true,
                })
                return
              }

              await interaction.reply({
                embeds: [
                  new EmbedBuilder()
                    .setTitle("No available codes")
                    .setDescription(
                      "Currently, there are no more unused Toyhouse invite codes. Please try again later!",
                    ),
                ],
                ephemeral: true,
              })
              return
            }

            await interaction.reply({
              embeds: [
                new EmbedBuilder()
                  .setTitle("Toyhouse invite code")
                  .setDescription("Here's a Toyhouse invite code!")
                  .setFields({ name: "Code", value: result.data.code })
                  .setFooter({
                    text: "If there are any issues with the code, please report this to a staff member.",
                  }),
              ],
              ephemeral: true,
            })
          },
        }),
      ],
    },
  ],
})

const addModal = modal({
  id: "thcode",
  title: "Add Toyhouse codes",
  components: [
    modalInput(
      "codes",
      true,
      new TextInputBuilder()
        .setStyle(TextInputStyle.Paragraph)
        .setLabel("Codes")
        .setMaxLength(2000)
        .setPlaceholder("A list of Toyhouse codes separated by whitespace."),
    ),
  ],
  async handle(interaction, { codes }) {
    const inserted = await Drizzle.insert(toyhouseTable)
      .values(
        codes
          .split(/\s+/)
          .map((s) => s.trim())
          .filter((s) => s.length === 10)
          .map((code) => ({ code, user: interaction.user.id })),
      )
      .onConflictDoNothing()
      .returning()

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`Added ${inserted.length} Toyhouse invite codes`)
          .setDescription(
            unorderedList(inserted.map(({ code }) => inlineCode(code))),
          )
          .setFooter({ text: "If any codes are missing, please try again." }),
      ],
      ephemeral: true,
    })
  },
})
