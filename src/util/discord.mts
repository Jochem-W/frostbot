/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import {
  ChannelType,
  type Channel,
  type Client,
  type FetchChannelOptions,
  type PublicThreadChannel,
  type Snowflake,
  Guild,
  type FetchMemberOptions,
  type UserResolvable,
  DiscordAPIError,
  RESTJSONErrorCodes,
  Attachment,
} from "discord.js"
import { MIMEType } from "util"

export async function fetchChannel<T extends ChannelType>(
  client: Client<true>,
  id: Snowflake,
  type: T | T[],
  options?: FetchChannelOptions,
) {
  const channel = await client.channels.fetch(id, options)
  if (!channel) {
    throw new Error(`Couldn't find a channel with ID ${id}`)
  }

  if (
    (typeof type === "number" && channel.type !== type) ||
    (typeof type === "object" && !type.includes(channel.type as T))
  )
    if (channel.type !== type) {
      throw new Error(
        `Type mismatch for channel ${channel.id}; expected ${
          type instanceof Array ? type.join(" | ") : type
        }, got ${channel.type}`,
      )
    }

  return channel as T extends
    | ChannelType.PublicThread
    | ChannelType.AnnouncementThread
    ? PublicThreadChannel
    : Extract<Channel, { type: T }>
}

export async function tryFetchMember(
  guild: Guild,
  options: UserResolvable | FetchMemberOptions,
) {
  try {
    return await guild.members.fetch(options)
  } catch (e) {
    if (
      !(e instanceof DiscordAPIError) ||
      e.code !== RESTJSONErrorCodes.UnknownMember
    ) {
      throw e
    }

    return null
  }
}

export function attachmentsAreImages(
  attachments: Attachment[],
): attachments is (Attachment & { contentType: `image/${string}` })[] {
  return !attachments.find(
    (attachment) =>
      !attachment.contentType ||
      new MIMEType(attachment.contentType).type !== "image",
  )
}

export function concatenate<Item>(
  items: Iterable<Item>,
  fn: (item: Item) => string,
  maxLength: number,
) {
  let result: string | null = null
  if (maxLength < 0) {
    return result
  }

  result ??= ""

  for (const item of items) {
    // eslint-disable-next-line @typescript-eslint/no-inferrable-types
    const newResult: string = `${result}${fn(item)}`
    if (newResult.length > maxLength) {
      break
    }

    result = newResult
  }

  return result
}
