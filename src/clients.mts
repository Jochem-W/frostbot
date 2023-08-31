import { Variables } from "./models/variables.mjs"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

export const Db = postgres(Variables.databaseUrl)
export const Drizzle = drizzle(Db)
