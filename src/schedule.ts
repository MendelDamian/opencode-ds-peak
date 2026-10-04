export const SOON_MS = 30 * 60_000

const BOUNDARY_HOURS = [1, 4, 6, 10]

export function isPeak(date: Date = new Date()): boolean {
  const day = date.getUTCDay()
  if (day === 0 || day === 6) return false

  const hour = date.getUTCHours()
  return (hour >= 1 && hour < 4) || (hour >= 6 && hour < 10)
}

export type Transition = {
  at: Date
  toPeak: boolean
}

export function nextTransition(from: Date = new Date()): Transition {
  for (let offset = 0; offset < 9; offset++) {
    const day = new Date(
      Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + offset, 0, 0, 0, 0),
    )
    for (const hour of BOUNDARY_HOURS) {
      const at = new Date(day.getTime() + hour * 3_600_000)
      if (at <= from) continue

      const before = isPeak(new Date(at.getTime() - 60_000))
      const after = isPeak(new Date(at.getTime() + 60_000))
      if (before !== after) return { at, toPeak: after }
    }
  }

  return { at: new Date(from.getTime() + 3_600_000), toPeak: !isPeak(from) }
}
