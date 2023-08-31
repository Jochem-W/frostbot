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
