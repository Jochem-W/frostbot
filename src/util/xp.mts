/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
const a = 12
const b = 33

export function xpForLevelUp(level: number) {
  return a * level + b
}

export function totalXpForLevel(level: number) {
  return (a / 2) * level ** 2 + (b - a / 2) * level
}

export function levelForTotalXp(xp: number) {
  return Math.floor(
    1 + (1 / a) * (Math.sqrt(2 * a * xp + (b - a / 2) ** 2) - (a / 2 + b)),
  )
}
