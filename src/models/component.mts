/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { Components } from "../components.mjs"
import {
  ComponentType,
  StringSelectMenuInteraction,
  UserSelectMenuInteraction,
  RoleSelectMenuInteraction,
  MentionableSelectMenuInteraction,
  ChannelSelectMenuInteraction,
  ButtonInteraction,
} from "discord.js"

function duplicateNameError(name: string): never {
  throw new Error(`A component with the name ${name} already exists`)
}

type Interaction<T extends ComponentType> = T extends ComponentType.Button
  ? ButtonInteraction
  : T extends ComponentType.StringSelect
    ? StringSelectMenuInteraction
    : T extends ComponentType.UserSelect
      ? UserSelectMenuInteraction
      : T extends ComponentType.RoleSelect
        ? RoleSelectMenuInteraction
        : T extends ComponentType.MentionableSelect
          ? MentionableSelectMenuInteraction
          : T extends ComponentType.ChannelSelect
            ? ChannelSelectMenuInteraction
            : never

export type Component<T extends ComponentType> = {
  type: T
  handle: (interaction: Interaction<T>) => Promise<void>
}

export function staticComponent<T extends ComponentType, TT extends string>({
  type,
  name,
  handle,
}: {
  type: T
  name: TT
  handle: (interaction: Interaction<T>) => Promise<void>
}) {
  if (Components.has(name)) {
    duplicateNameError(name)
  }

  Components.set(name, {
    type,
    handle: handle as (
      interaction: Interaction<ComponentType>,
    ) => Promise<void>,
  })

  return name
}

export function component<
  T extends ComponentType,
  TT extends string,
  TTT extends readonly string[],
>({
  type,
  name,
  handle,
}: {
  type: T
  name: TT
  handle: (interaction: Interaction<T>, ...args: TTT) => Promise<void>
}) {
  if (Components.has(name)) {
    duplicateNameError(name)
  }

  Components.set(name, {
    type,
    handle: async function handleWrapper(interaction) {
      await handle(
        interaction as Interaction<T>,
        ...(interaction.customId.split(":").slice(1) as [...TTT]),
      )
    },
  })

  function generateCustomId(...args: TTT) {
    return `${name}:${args.join(":")}`
  }

  return generateCustomId
}
