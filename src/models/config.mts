/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { readFile } from "fs/promises"
import { z } from "zod"

const model = z.object({
  channels: z.object({ error: z.string().optional(), mod: z.string().array() }),
  levelRoles: z
    .record(z.string())
    .transform((arg) => new Map(Object.entries(arg))),
  guild: z.string(),
  xp: z.object({
    max: z.number(),
    min: z.number(),
    curve: z.number(),
    dropoff: z.number(),
    time: z.number(),
    enabled: z.boolean(),
  }),
  url: z.object({ internal: z.string().url(), external: z.string().url() }),
  s3: z.object({
    bucket: z.string(),
    bucketUrl: z.string().url(),
    region: z.string(),
    endpoint: z.string(),
  }),
  migrate: z.boolean().optional().default(true),
})

export const Config = await model.parseAsync(
  JSON.parse(await readFile("config.json", { encoding: "utf-8" })),
)
