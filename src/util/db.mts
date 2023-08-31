import { Drizzle } from "../clients.mjs"
import { usersTable } from "../schema.mjs"
import { sql, desc, asc, eq } from "drizzle-orm"

const position = sql<string>`row_number() OVER (ORDER BY ${desc(
  usersTable.xp,
)}, ${asc(usersTable.id)})`.as("position")

const userPosition = Drizzle.select({
  id: usersTable.id,
  position,
})
  .from(usersTable)
  .as("userPosition")

export async function selectUser(id: string) {
  const [user] = await Drizzle.select({
    user: usersTable,
    position: userPosition.position,
  })
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .innerJoin(userPosition, eq(userPosition.id, id))
  return user ? user : null
}
