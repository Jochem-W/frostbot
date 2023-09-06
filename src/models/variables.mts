import camelcaseKeys from "camelcase-keys"
import { env } from "process"
import { z } from "zod"

const model = z
  .object({
    BOT_TOKEN: z.string(),
    DATABASE_URL: z.string(),
    NODE_ENV: z.string().optional().default("development"),
    S3_ACCESS_KEY_ID: z.string(),
    S3_SECRET_ACCESS_KEY: z.string(),
  })
  .transform((arg) => camelcaseKeys(arg))

export const Variables = await model.parseAsync(env)
