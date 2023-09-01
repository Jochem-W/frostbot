import { Drizzle } from "../clients.mjs"
import { slashCommand, slashOption } from "../models/slashCommand.mjs"
import { Variables } from "../models/variables.mjs"
import { usersTable } from "../schema.mjs"
import { selectUser } from "../util/db.mjs"
import { AttachmentBuilder, SlashCommandUserOption } from "discord.js"
import { sql } from "drizzle-orm"
import puppeteer from "puppeteer"

const browser = await puppeteer.launch({
  headless: "new",
  defaultViewport: { width: 1024, height: 384 },
  args: ["--no-sandbox"],
})

export const RankCommand = slashCommand({
  name: "rank",
  description: "View your own rank card, or that of another user.",
  defaultMemberPermissions: null,
  dmPermission: true,
  options: [
    slashOption(
      false,
      new SlashCommandUserOption()
        .setName("user")
        .setDescription("Target user"),
    ),
  ],
  async handle(interaction, user) {
    if (!user) {
      user = interaction.user
    }

    let dbResult = await selectUser(user.id)
    if (!dbResult) {
      const [countResult] = await Drizzle.select({
        count: sql<string>`count(*)`,
      }).from(usersTable)
      if (!countResult) {
        return
      }

      dbResult = {
        user: { xp: 0, id: user.id },
        position: (parseInt(countResult.count) + 1).toString(10),
      }
    }

    const params = new URLSearchParams({
      id: dbResult.user.id,
      username: user.username,
      discriminator: user.discriminator,
      xp: dbResult.user.xp.toString(10),
      position: dbResult.position,
    })

    if (user.globalName) {
      params.set("global_name", user.globalName)
    }

    if (user.avatar) {
      params.set("avatar", user.avatar)
    }

    const page = await browser.newPage()
    await page.setJavaScriptEnabled(false)
    await page.goto(`${Variables.cardUrl}/card?${params.toString()}`)
    const screenshot = await page.screenshot()

    await interaction.reply({
      files: [new AttachmentBuilder(screenshot, { name: "card.png" })],
    })

    await page.close()
  },
})
