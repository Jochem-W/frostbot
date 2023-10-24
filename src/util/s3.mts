import { S3 } from "../clients.mjs"
import { Config } from "../models/config.mjs"
import { Options, Upload } from "@aws-sdk/lib-storage"
import { Attachment } from "discord.js"

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
    options.params.Body = response.body
  }

  await new Upload(options).done()

  return { key, url: fileURL(key) }
}

export function fileURL(key: string) {
  return new URL(key, Config.s3.bucketUrl)
}
