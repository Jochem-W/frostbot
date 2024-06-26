/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { S3 } from "../clients.mjs"
import { Config } from "../models/config.mjs"
import { Options, Upload } from "@aws-sdk/lib-storage"
import { Attachment } from "discord.js"
import { Readable } from "stream"

export async function uploadAttachment(
  attachment: Attachment & { contentType: string },
) {
  const response = await fetch(attachment.url)
  if (!response.ok) {
    throw new Error(`Download of attachment ${attachment.url} failed`)
  }

  const key = `${attachment.id}/${attachment.name}`

  const options: Options = {
    client: S3,
    params: {
      Bucket: Config.s3.bucket,
      Key: key,
      ContentType: attachment.contentType,
    },
  }

  if (response.body) {
    options.params.Body = response.body as unknown as Readable
  }

  await new Upload(options).done()

  return { key, url: fileURL(key) }
}

export async function uploadAttachments(
  attachments: (Attachment & { contentType: string })[],
) {
  const results = await Promise.allSettled(attachments.map(uploadAttachment))

  const rejected = []
  const fulfilled = []
  for (const result of results) {
    switch (result.status) {
      case "fulfilled":
        fulfilled.push(result)
        break
      case "rejected":
        rejected.push(result)
        break
    }
  }

  return { fulfilled, rejected }
}

export function fileURL(key: string) {
  return new URL(key, Config.s3.bucketUrl)
}
