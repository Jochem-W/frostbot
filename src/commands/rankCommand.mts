import { Drizzle } from "../clients.mjs"
import { addExitListener } from "../handlers/readyHandler.mjs"
import { Config } from "../models/config.mjs"
import { slashCommand, slashOption } from "../models/slashCommand.mjs"
import { usersTable } from "../schema.mjs"
import { userPosition } from "../util/db.mjs"
import { AttachmentBuilder, SlashCommandUserOption } from "discord.js"
import { eq, sql } from "drizzle-orm"
import puppeteer from "puppeteer"

const browser = await puppeteer.launch({
  headless: "new",
  defaultViewport: { width: 1024, height: 384 },
  args: ["--no-sandbox"],
})

addExitListener(async () => await browser.close())

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

    let [levelData] = await Drizzle.select({
      xp: usersTable.xp,
      position: userPosition.position,
    })
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .innerJoin(userPosition, eq(userPosition.id, user.id))

    if (!levelData) {
      const [countResult] = await Drizzle.select({
        count: sql<string>`count(*)`,
      }).from(usersTable)
      if (!countResult) {
        return
      }

      levelData = {
        xp: 0,
        position: (parseInt(countResult.count) + 1).toString(10),
      }
    }

    const url = new URL("card", Config.url.internal)
    url.searchParams.set("id", user.id)
    url.searchParams.set("name", user.displayName)
    url.searchParams.set("discriminator", user.discriminator)
    url.searchParams.set("xp", levelData.xp.toString(10))
    url.searchParams.set("position", levelData.position)

    if (user.avatar) {
      url.searchParams.set("avatar", user.avatar)
    }

    const page = await browser.newPage()
    await page.goto(url.toString())
    const screenshot = await page.screenshot()

    await interaction.reply({
      files: [new AttachmentBuilder(screenshot, { name: "card.png" })],
    })

    await page.close()
  },
})
