import camelcaseKeys from "camelcase-keys"
import { env } from "process"
import { z } from "zod"

const model = z
  .object({
    BOT_TOKEN: z.string(),
    DATABASE_URL: z.string(),
    NODE_ENV: z.string().optional().default("development"),
  })
  .transform((arg) => camelcaseKeys(arg))

export const Variables = await model.parseAsync(env)
