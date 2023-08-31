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
  type Interaction,
  DiscordAPIError,
  RESTJSONErrorCodes,
} from "discord.js"

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

export async function tryFetchChannel<T extends ChannelType>(
  client: Client<true>,
  id: Snowflake,
  type: T | T[],
  options?: FetchChannelOptions,
) {
  try {
    return await fetchChannel(client, id, type, options)
  } catch (e) {
    return null
  }
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

export async function interactionGuild(interaction: Interaction) {
  if (!interaction.inGuild()) {
    return null
  }

  if (interaction.guild) {
    return interaction.guild
  }

  return await interaction.client.guilds.fetch(interaction.guildId)
}
