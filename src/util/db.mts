/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { Drizzle } from "../clients.mjs"
import { actionsTable, attachmentsTable, usersTable } from "../schema.mjs"
import { sql, desc, asc, eq, SQL, and } from "drizzle-orm"

export type ActionWithImages = typeof actionsTable.$inferSelect & {
  images: (typeof attachmentsTable.$inferSelect)[]
}
export type ActionWithOptionalImages = Omit<ActionWithImages, "images"> & {
  images?: ActionWithImages["images"]
}

export const position = sql<string>`row_number() OVER (ORDER BY ${desc(
  usersTable.xp,
)}, ${asc(usersTable.id)})`.as("position")

export const userPosition = Drizzle.select({
  id: usersTable.id,
  position,
})
  .from(usersTable)
  .as("userPosition")

export async function actionsWithImages({
  where,
  orderBy,
}: {
  where: SQL<unknown>
  orderBy: SQL<unknown>
}) {
  const actions = await Drizzle.select()
    .from(actionsTable)
    .where(where)
    .orderBy(orderBy)
    .leftJoin(
      attachmentsTable,
      and(
        eq(actionsTable.id, attachmentsTable.actionId),
        eq(actionsTable.hidden, false),
      ),
    )

  const set = new Map<number, ActionWithImages>()

  for (const entry of actions) {
    if (!set.has(entry.actions.id)) {
      set.set(entry.actions.id, {
        ...entry.actions,
        images: entry.attachments ? [entry.attachments] : [],
      })
      continue
    }

    if (!entry.attachments) {
      continue
    }

    set.get(entry.actions.id)?.images.push(entry.attachments)
  }

  return [...set.values()]
}

export async function actionWithImages(where: SQL<unknown>) {
  const action = await Drizzle.select()
    .from(actionsTable)
    .where(where)
    .leftJoin(attachmentsTable, eq(actionsTable.id, attachmentsTable.actionId))

  if (!action[0]) {
    throw new Error() // TODO
  }

  const data: ActionWithImages = { ...action[0].actions, images: [] }
  for (const entry of action) {
    if (entry.attachments) {
      data.images.push(entry.attachments)
    }
  }

  return data
}
