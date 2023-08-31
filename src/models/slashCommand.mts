import {
  type ChatInputCommandInteraction,
  SlashCommandStringOption,
  SlashCommandNumberOption,
  SlashCommandBooleanOption,
  SlashCommandUserOption,
  SlashCommandChannelOption,
  SlashCommandRoleOption,
  SlashCommandMentionableOption,
  SlashCommandIntegerOption,
  SlashCommandAttachmentOption,
  User,
  type Channel,
  Role,
  Attachment,
  AutocompleteInteraction,
  type AutocompleteFocusedOption,
  GuildMember,
  type ApplicationCommandOptionChoiceData,
  SlashCommandBuilder,
  ApplicationCommandOptionType,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
  ApplicationCommandType,
  CommandInteraction,
} from "discord.js"

type Options =
  | SlashCommandStringOption
  | SlashCommandIntegerOption
  | SlashCommandBooleanOption
  | SlashCommandUserOption
  | SlashCommandChannelOption
  | SlashCommandRoleOption
  | SlashCommandMentionableOption
  | SlashCommandNumberOption
  | SlashCommandAttachmentOption

type OptionValue<T extends Options> = T extends SlashCommandStringOption
  ? string
  : T extends SlashCommandIntegerOption
  ? number
  : T extends SlashCommandBooleanOption
  ? boolean
  : T extends SlashCommandUserOption
  ? User
  : T extends SlashCommandChannelOption
  ? Channel
  : T extends SlashCommandRoleOption
  ? Role
  : T extends SlashCommandMentionableOption
  ? GuildMember | Role | User
  : T extends SlashCommandNumberOption
  ? number
  : T extends SlashCommandAttachmentOption
  ? Attachment
  : never

type OptionValueWithRequired<
  T extends Options,
  TT extends boolean,
> = TT extends true ? OptionValue<T> : OptionValue<T> | null

type InferOptionValuesWithRequired<
  T extends readonly unknown[],
  R extends readonly unknown[] = readonly [],
> = T extends readonly [infer TH, ...infer TT]
  ? InferOptionValuesWithRequired<
      TT,
      TH extends SlashOption<Options, boolean>
        ? readonly [...R, OptionValueWithRequired<TH["option"], TH["required"]>]
        : R
    >
  : R

type Handler<
  T extends readonly [...(readonly SlashOption<Options, boolean>[])],
> = (
  interaction: ChatInputCommandInteraction,
  ...values: readonly [...InferOptionValuesWithRequired<T>]
) => Promise<void>

// TODO: fix return type to be string or number correctly
type AutocompleteHandler<T extends Options> = T extends
  | SlashCommandStringOption
  | SlashCommandIntegerOption
  | SlashCommandNumberOption
  ? (
      interaction: AutocompleteInteraction,
      value: AutocompleteFocusedOption & { type: T["type"] },
    ) =>
      | ApplicationCommandOptionChoiceData[]
      | Promise<ApplicationCommandOptionChoiceData[]>
  : never

type SlashCommandInput<T extends readonly SlashOption<Options, boolean>[]> =
  | {
      name: Lowercase<string>
      description: string
      defaultMemberPermissions: bigint | null
      dmPermission: boolean
      options?: [...T]
      handle: Handler<T>
      transform?: (builder: SlashCommandBuilder) => void
    }
  | {
      name: Lowercase<string>
      description: string
      defaultMemberPermissions: bigint | null
      dmPermission: boolean
      subcommands?: readonly ReturnType<typeof subcommand>[]
      subcommandGroups: readonly ReturnType<typeof subcommandGroup>[]
      transform?: (builder: SlashCommandBuilder) => void
    }
  | {
      name: Lowercase<string>
      description: string
      defaultMemberPermissions: bigint | null
      dmPermission: boolean
      subcommands: readonly ReturnType<typeof subcommand>[]
      subcommandGroups?: readonly ReturnType<typeof subcommandGroup>[]
      transform?: (builder: SlashCommandBuilder) => void
    }

function optionNotFound(option: AutocompleteFocusedOption): never {
  throw new Error(`Couldn't find an option with the name ${option.name}`)
}

function noAutocompleteHandler(option: SlashOption<Options, boolean>): never {
  throw new Error(
    `Option with name ${option.option.name} doesn't have an autocomplete handler`,
  )
}

function subcommandGroupNotFound(
  interaction: CommandInteraction | AutocompleteInteraction,
  name: string,
): never {
  throw new Error(
    `Couldn't find a subcommand group with name ${name} for command ${interaction.commandName}`,
  )
}

function subcommandNotFound(
  interaction: CommandInteraction | AutocompleteInteraction,
  name: string,
): never {
  throw new Error(
    `Couldn't find a subcommand with name ${name} for command ${interaction.commandName}`,
  )
}

function registerOption<T extends Options>(
  builder: SlashCommandBuilder | SlashCommandSubcommandBuilder,
  option: T,
) {
  switch (option.type) {
    case ApplicationCommandOptionType.String:
      builder.addStringOption(option)
      break
    case ApplicationCommandOptionType.Integer:
      builder.addIntegerOption(option)
      break
    case ApplicationCommandOptionType.Boolean:
      builder.addBooleanOption(option)
      break
    case ApplicationCommandOptionType.User:
      builder.addUserOption(option)
      break
    case ApplicationCommandOptionType.Channel:
      builder.addChannelOption(option)
      break
    case ApplicationCommandOptionType.Role:
      builder.addRoleOption(option)
      break
    case ApplicationCommandOptionType.Mentionable:
      builder.addMentionableOption(option)
      break
    case ApplicationCommandOptionType.Number:
      builder.addNumberOption(option)
      break
    case ApplicationCommandOptionType.Attachment:
      builder.addAttachmentOption(option)
      break
  }
}

function getOptionValue<T extends Options, TT extends boolean>(
  interaction: ChatInputCommandInteraction,
  option: T,
  required: TT,
) {
  let value
  switch (option.type) {
    case ApplicationCommandOptionType.String:
      value = interaction.options.getString(option.name, required)
      break
    case ApplicationCommandOptionType.Integer:
      value = interaction.options.getInteger(option.name, required)
      break
    case ApplicationCommandOptionType.Boolean:
      value = interaction.options.getBoolean(option.name, required)
      break
    case ApplicationCommandOptionType.User:
      value = interaction.options.getUser(option.name, required)
      break
    case ApplicationCommandOptionType.Channel:
      value = interaction.options.getChannel(option.name, required)
      break
    case ApplicationCommandOptionType.Role:
      value = interaction.options.getRole(option.name, required)
      break
    case ApplicationCommandOptionType.Mentionable:
      value = interaction.options.getMentionable(option.name, required)
      break
    case ApplicationCommandOptionType.Number:
      value = interaction.options.getNumber(option.name, required)
      break
    case ApplicationCommandOptionType.Attachment:
      value = interaction.options.getAttachment(option.name, required)
      break
  }

  return value as OptionValueWithRequired<T, TT>
}

export function slashCommand<
  T extends readonly SlashOption<Options, boolean>[],
>(input: SlashCommandInput<T>) {
  const {
    name,
    description,
    defaultMemberPermissions,
    dmPermission,
    transform,
  } = input
  const builder = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .setDefaultMemberPermissions(defaultMemberPermissions)
    .setDMPermission(dmPermission)

  let getOptionsAndHandle
  let autocomplete
  if ("handle" in input) {
    const { options, handle } = input

    options?.map(({ option }) => registerOption(builder, option))

    autocomplete = async (interaction: AutocompleteInteraction) => {
      const autocompleteOption = interaction.options.getFocused(true)
      const option = options?.find(
        ({ option }) => option.name === autocompleteOption.name,
      )

      if (!option) {
        optionNotFound(autocompleteOption)
      }

      if (!option.autocomplete) {
        noAutocompleteHandler(option)
      }

      await interaction.respond(
        await option.autocomplete(interaction, autocompleteOption as never),
      )
    }

    getOptionsAndHandle = async (interaction: ChatInputCommandInteraction) => {
      const values = (options?.map(({ option, required }) =>
        getOptionValue(interaction, option, required),
      ) ?? []) as [...InferOptionValuesWithRequired<T>]
      await handle(interaction, ...values)
    }
  } else {
    const { subcommands, subcommandGroups } = input

    if (subcommands) {
      for (const subcommand of subcommands) {
        builder.addSubcommand(subcommand.builder)
      }
    }

    if (subcommandGroups) {
      for (const subcommandGroup of subcommandGroups) {
        builder.addSubcommandGroup(subcommandGroup.builder)
      }
    }

    autocomplete = async (interaction: AutocompleteInteraction) => {
      const subcommandGroupName = interaction.options.getSubcommandGroup()
      const subcommandName = interaction.options.getSubcommand(true)

      let subcommand
      if (subcommandGroupName) {
        const subcommandGroup = subcommandGroups?.find(
          (g) => g.builder.name === subcommandGroupName,
        )
        if (!subcommandGroup) {
          subcommandGroupNotFound(interaction, subcommandGroupName)
        }

        subcommand = subcommandGroup.subcommands.find(
          (s) => s.builder.name === subcommandName,
        )
      } else {
        subcommand = subcommands?.find((s) => s.builder.name === subcommandName)
      }

      if (!subcommand) {
        subcommandNotFound(interaction, subcommandName)
      }

      await interaction.respond(await subcommand.autocomplete(interaction))
    }

    getOptionsAndHandle = async (interaction: ChatInputCommandInteraction) => {
      const subcommandGroupName = interaction.options.getSubcommandGroup()
      const subcommandName = interaction.options.getSubcommand(true)

      let subcommand
      if (subcommandGroupName) {
        const subcommandGroup = subcommandGroups?.find(
          (g) => g.builder.name === subcommandGroupName,
        )
        if (!subcommandGroup) {
          subcommandGroupNotFound(interaction, subcommandGroupName)
        }

        subcommand = subcommandGroup.subcommands.find(
          (s) => s.builder.name === subcommandName,
        )
      } else {
        subcommand = subcommands?.find((s) => s.builder.name === subcommandName)
      }

      if (!subcommand) {
        subcommandNotFound(interaction, subcommandName)
      }

      await subcommand.handle(interaction)
    }
  }

  if (transform) {
    transform(builder)
  }

  return {
    type: ApplicationCommandType.ChatInput as ApplicationCommandType.ChatInput,
    builder,
    handle: getOptionsAndHandle,
    autocomplete,
  }
}

type SlashOption<T extends Options, TT extends boolean> = {
  option: T
  required: TT
  autocomplete?: AutocompleteHandler<T>
}

export function slashOption<T extends Options, TT extends boolean>(
  required: TT,
  data:
    | {
        option: T
        autocomplete?: AutocompleteHandler<T>
      }
    | T,
) {
  let option
  let autocomplete
  if ("option" in data) {
    option = data.option
    autocomplete = data.autocomplete
  } else {
    option = data
    autocomplete = undefined
  }

  if (required) {
    option.setRequired(true)
  }

  if (autocomplete) {
    if (
      !(
        option instanceof SlashCommandStringOption ||
        option instanceof SlashCommandNumberOption ||
        option instanceof SlashCommandIntegerOption
      )
    ) {
      throw new Error(`Options of type ${option.type} can't be autocompleted`)
    }

    option.setAutocomplete(true)
  }

  return {
    autocomplete,
    option,
    required,
  } as SlashOption<T, TT>
}

export function groupedSubcommand<
  T extends readonly SlashOption<Options, boolean>[],
>({
  name,
  description,
  options,
  handle,
  transform,
}: {
  name: Lowercase<string>
  description: string
  options?: [...T]
  handle: Handler<T>
  transform?: (builder: SlashCommandSubcommandBuilder) => void
}) {
  const builder = new SlashCommandSubcommandBuilder()
    .setName(name)
    .setDescription(description)

  options?.map(({ option }) => registerOption(builder, option))

  if (transform) {
    transform(builder)
  }

  const autocomplete = (interaction: AutocompleteInteraction) => {
    const autocompleteOption = interaction.options.getFocused(true)
    const option = options?.find(
      ({ option }) => option.name === autocompleteOption.name,
    )

    if (!option) {
      optionNotFound(autocompleteOption)
    }

    if (!option.autocomplete) {
      noAutocompleteHandler(option)
    }

    return option.autocomplete(interaction, autocompleteOption as never)
  }

  const getOptionsAndHandle = async (
    interaction: ChatInputCommandInteraction,
  ) => {
    const values = (options?.map(({ option, required }) =>
      getOptionValue(interaction, option, required),
    ) ?? []) as [...InferOptionValuesWithRequired<T>]

    await handle(interaction, ...values)
  }

  return { builder, handle: getOptionsAndHandle, autocomplete, grouped: true }
}

export function subcommand<T extends readonly SlashOption<Options, boolean>[]>({
  name,
  description,
  options,
  handle,
  transform,
}: {
  name: Lowercase<string>
  description: string
  options?: [...T]
  handle: Handler<T>
  transform?: (builder: SlashCommandSubcommandBuilder) => void
}) {
  const builder = new SlashCommandSubcommandBuilder()
    .setName(name)
    .setDescription(description)

  options?.map(({ option }) => registerOption(builder, option))

  if (transform) {
    transform(builder)
  }

  const autocomplete = (interaction: AutocompleteInteraction) => {
    const autocompleteOption = interaction.options.getFocused(true)
    const option = options?.find(
      ({ option }) => option.name === autocompleteOption.name,
    )

    if (!option) {
      optionNotFound(autocompleteOption)
    }

    if (!option.autocomplete) {
      noAutocompleteHandler(option)
    }

    return option.autocomplete(interaction, autocompleteOption as never)
  }

  const getOptionsAndHandle = async (
    interaction: ChatInputCommandInteraction,
  ) => {
    const values = (options?.map(({ option, required }) =>
      getOptionValue(interaction, option, required),
    ) ?? []) as [...InferOptionValuesWithRequired<T>]

    await handle(interaction, ...values)
  }

  return { builder, handle: getOptionsAndHandle, autocomplete }
}

export function subcommandGroup({
  name,
  description,
  subcommands,
  transform,
}: {
  name: Lowercase<string>
  description: string
  subcommands: ReturnType<typeof groupedSubcommand>[]
  transform?: (builder: SlashCommandSubcommandGroupBuilder) => void
}) {
  const builder = new SlashCommandSubcommandGroupBuilder()
    .setName(name)
    .setDescription(description)

  for (const subcommand of subcommands) {
    builder.addSubcommand(subcommand.builder)
  }

  if (transform) {
    transform(builder)
  }

  return { builder, subcommands }
}
