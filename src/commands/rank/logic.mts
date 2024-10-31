/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { Drizzle } from "../../clients.mjs"
import { addExitListener } from "../../handlers/readyHandler.mjs"
import { Config } from "../../models/config.mjs"
import { usersTable } from "../../schema.mjs"
import { userPosition } from "../../util/db.mjs"
import { AttachmentBuilder, CommandInteraction, User } from "discord.js"
import { eq, sql } from "drizzle-orm"
import puppeteer from "puppeteer"

const browser = Config.xp.enabled
  ? await puppeteer.launch({
      headless: true,
      defaultViewport: { width: 1024, height: 384 },
      args: ["--no-sandbox"],
    })
  : (undefined as unknown as puppeteer.Browser)

addExitListener(async () => await browser.close())

export async function sendRankCard(
  interaction: CommandInteraction,
  user: User,
  ephemeral: boolean,
) {
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
  const buffer = Buffer.from(screenshot)

  await interaction.reply({
    files: [new AttachmentBuilder(buffer, { name: "card.png" })],
    ephemeral,
  })

  await page.close()
}
