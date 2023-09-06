import { readFile } from "fs/promises"
import { z } from "zod"

const model = z.object({
  channels: z.object({ error: z.string(), mod: z.string() }),
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
  }),
  baseUrl: z.string().url(),
  s3: z.object({
    bucket: z.string(),
    bucketUrl: z.string().url(),
    region: z.string(),
    endpoint: z.string(),
  }),
})

export const Config = await model.parseAsync(
  JSON.parse(await readFile("config.json", { encoding: "utf-8" })),
)
