import type { ClientEvents } from "discord.js"

export function handler<T extends keyof ClientEvents>({
  event,
  once,
  handle,
}: {
  event: T
  once: boolean
  handle: (...args: ClientEvents[T]) => Promise<void> | void
}) {
  return {
    event,
    once,
    handle,
  }
}

export type Handler<T extends keyof ClientEvents> = {
  readonly event: T
  readonly once: boolean
  handle(...data: ClientEvents[T]): Promise<void> | void
}
