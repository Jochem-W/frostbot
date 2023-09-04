import type { SelectMenuComponentOptionData } from "discord.js"
import { Duration } from "luxon"

export const timeoutOptions: SelectMenuComponentOptionData[] = [
  {
    label: "1 day",
    value: Duration.fromObject({ days: 1 }).toMillis().toString(10),
  },
  {
    label: "1 week",
    value: Duration.fromObject({ weeks: 1 }).toMillis().toString(10),
  },
]

export const messageDeleteOptions: SelectMenuComponentOptionData[] = [
  {
    label: "Don't delete any messages",
    emoji: "🗑️",
    value: "0",
  },
  {
    label: "Delete the previous hour of messages",
    emoji: "🕐",
    value: Duration.fromObject({ hours: 1 }).as("seconds").toString(10),
  },
  {
    label: "Delete the previous 6 hours of messages",
    emoji: "🕕",
    value: Duration.fromObject({ hours: 6 }).as("seconds").toString(10),
  },
  {
    label: "Delete the previous 12 hours of messages",
    emoji: "🕛",
    value: Duration.fromObject({ hours: 12 }).as("seconds").toString(10),
  },
  {
    label: "Delete the previous 24 hours of messages",
    emoji: "🕛",
    value: Duration.fromObject({ hours: 24 }).as("seconds").toString(10),
  },
  {
    label: "Delete the previous 3 days of messages",
    emoji: "📅",
    value: Duration.fromObject({ days: 3 }).as("seconds").toString(10),
  },
  {
    label: "Delete the previous 7 days of messages",
    emoji: "📅",
    value: Duration.fromObject({ days: 7 }).as("seconds").toString(10),
  },
]
