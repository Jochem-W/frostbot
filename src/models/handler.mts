import type { ClientEvents } from "discord.js"

export function handler<T extends keyof ClientEvents>({
  event,
  once,
  handle,
  enabled,
}: {
  event: T
  once: boolean
  enabled?: boolean
  handle: (...args: ClientEvents[T]) => Promise<void> | void
}) {
  return {
    event,
    once,
    handle,
    enabled: enabled ?? true,
  }
}

export type Handler<T extends keyof ClientEvents> = {
  readonly enabled: boolean
  readonly event: T
  readonly once: boolean
  handle(...data: ClientEvents[T]): Promise<void> | void
}
