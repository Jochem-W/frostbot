/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import camelcaseKeys from "camelcase-keys"
import { env } from "process"
import { z } from "zod"

const model = z
  .object({
    BOT_TOKEN: z.string(),
    DATABASE_URL: z.string(),
    S3_ACCESS_KEY_ID: z.string(),
    S3_SECRET_ACCESS_KEY: z.string(),
    RABBIT_URL: z.string(),
  })
  .transform((arg) => camelcaseKeys(arg))

export const Variables = await model.parseAsync(env)
