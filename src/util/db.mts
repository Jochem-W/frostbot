import { Drizzle } from "../clients.mjs"
import { usersTable } from "../schema.mjs"
import { sql, desc, asc } from "drizzle-orm"

export const position = sql<string>`row_number() OVER (ORDER BY ${desc(
  usersTable.xp,
)}, ${asc(usersTable.id)})`.as("position")

export const userPosition = Drizzle.select({
  id: usersTable.id,
  position,
})
  .from(usersTable)
  .as("userPosition")
