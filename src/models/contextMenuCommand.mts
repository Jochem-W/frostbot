import {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  type ContextMenuCommandType,
  type Message,
  type MessageContextMenuCommandInteraction,
  type User,
  type UserContextMenuCommandInteraction,
} from "discord.js"

type Interaction<T extends ContextMenuCommandType> =
  T extends ApplicationCommandType.Message
    ? MessageContextMenuCommandInteraction
    : T extends ApplicationCommandType.User
      ? UserContextMenuCommandInteraction
      : never

type Value<T extends ContextMenuCommandType> =
  T extends ApplicationCommandType.Message
    ? Message
    : T extends ApplicationCommandType.User
      ? User
      : never

export function contextMenuCommand<T extends ContextMenuCommandType>({
  name,
  type,
  defaultMemberPermissions,
  dmPermission,
  transform,
  handle,
}: {
  name: string
  type: T
  defaultMemberPermissions: bigint | null
  dmPermission: boolean
  transform?: (builder: ContextMenuCommandBuilder) => void
  handle: (interaction: Interaction<T>, value: Value<T>) => Promise<void>
}) {
  const builder = new ContextMenuCommandBuilder()
    .setName(name)
    .setType(type)
    .setDefaultMemberPermissions(defaultMemberPermissions)
    .setDMPermission(dmPermission)

  if (transform) {
    transform(builder)
  }

  const getOptionAndHandle = async (interaction: Interaction<T>) => {
    switch (interaction.commandType) {
      case ApplicationCommandType.Message:
        await handle(interaction, interaction.targetMessage as Value<T>)
        break
      case ApplicationCommandType.User:
        await handle(interaction, interaction.targetUser as Value<T>)
        break
    }
  }

  return { builder, handle: getOptionAndHandle, type }
}
