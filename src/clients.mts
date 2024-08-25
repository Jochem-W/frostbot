/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { Config } from "./models/config.mjs"
import { Variables } from "./models/variables.mjs"
import { S3Client } from "@aws-sdk/client-s3"
import amqplib from "amqplib"
import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"

export const Db = postgres(Variables.databaseUrl)
export const Drizzle = drizzle(Db)
export const S3 = new S3Client({
  region: Config.s3.region,
  endpoint: Config.s3.endpoint,
  credentials: {
    accessKeyId: Variables.s3AccessKeyId,
    secretAccessKey: Variables.s3SecretAccessKey,
  },
})

export const Exchange = "action_executed"

const amqp = await amqplib.connect(Variables.rabbitUrl)
export const ProducerChannel = await amqp.createChannel()
await ProducerChannel.assertExchange(Exchange, "fanout")

export const ConsumerChannel = await amqp.createChannel()
await ConsumerChannel.assertExchange(Exchange, "fanout")
const { queue } = await ConsumerChannel.assertQueue("", { exclusive: true })
await ConsumerChannel.bindQueue(queue, Exchange, "")
export const Queue = queue

if (Config.migrate) {
  await migrate(Drizzle, { migrationsFolder: "./drizzle" })
}
