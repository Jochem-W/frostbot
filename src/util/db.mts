import { Drizzle } from "../clients.mjs"
import { actionsTable, attachmentsTable, usersTable } from "../schema.mjs"
import { sql, desc, asc, eq, SQL } from "drizzle-orm"

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
    .leftJoin(attachmentsTable, eq(actionsTable.id, attachmentsTable.actionId))

  const set = new Map<
    number,
    typeof actionsTable.$inferSelect & {
      images: (typeof attachmentsTable.$inferSelect)[]
    }
  >()

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
