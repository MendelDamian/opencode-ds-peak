export const SOON_MS = 30 * 60_000

declare const peakWindowBrand: unique symbol

export type PeakWindow = {
  readonly from: number
  readonly to: number
  readonly [peakWindowBrand]: true
}

export function isPeakWindow(value: unknown): value is PeakWindow {
  if (typeof value !== "object" || value === null) return false
  if (!("from" in value) || !("to" in value)) return false

  const from = value.from
  const to = value.to
  return (
    typeof from === "number" &&
    typeof to === "number" &&
    Number.isInteger(from) &&
    Number.isInteger(to) &&
    from >= 0 &&
    to <= 1440 &&
    from < to
  )
}

export function peakWindow(from: number, to: number): PeakWindow {
  const candidate = { from, to }
  if (!isPeakWindow(candidate)) throw new Error(`peakWindow: invalid window ${from}-${to}`)
  return candidate
}

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type Schedule = {
  windows: readonly PeakWindow[]
  days: ReadonlySet<Weekday>
  holidays: ReadonlySet<string>
}

export type Transition = {
  at: Date
  toPeak: boolean
}

export const DEFAULT_WINDOWS: readonly PeakWindow[] = [peakWindow(60, 240), peakWindow(360, 600)]

export const DEFAULT_DAYS: readonly Weekday[] = [1, 2, 3, 4, 5]

const ISO_WEEKDAYS = [7, 1, 2, 3, 4, 5, 6] as const

type WeekIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6

function isWeekIndex(value: number): value is WeekIndex {
  return Number.isInteger(value) && value >= 0 && value <= 6
}

function isoWeekday(date: Date): Weekday {
  const day = date.getUTCDay()
  return isWeekIndex(day) ? ISO_WEEKDAYS[day] : 1
}

function utcDateKey(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function isHoliday(schedule: Schedule, date: Date = new Date()): boolean {
  return schedule.holidays.has(utcDateKey(date))
}

export function isObservedHoliday(schedule: Schedule, date: Date = new Date()): boolean {
  return isHoliday(schedule, date) && schedule.days.has(isoWeekday(date))
}

export function isPeak(schedule: Schedule, date: Date = new Date()): boolean {
  if (isHoliday(schedule, date)) return false
  if (!schedule.days.has(isoWeekday(date))) return false

  const minutes = date.getUTCHours() * 60 + date.getUTCMinutes()
  return schedule.windows.some((window) => minutes >= window.from && minutes < window.to)
}

export function nextTransition(schedule: Schedule, from: Date = new Date()): Transition | undefined {
  const boundaries = [...new Set(schedule.windows.flatMap((window) => [window.from, window.to]))].sort(
    (a, b) => a - b,
  )
  if (boundaries.length === 0) return undefined

  const horizon = (schedule.holidays.size + 1) * 7 + 1

  for (let offset = 0; offset < horizon; offset++) {
    const midnight = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + offset, 0, 0, 0, 0)
    for (const minute of boundaries) {
      const at = new Date(midnight + minute * 60_000)
      if (at <= from) continue

      const before = isPeak(schedule, new Date(at.getTime() - 1))
      const after = isPeak(schedule, at)
      if (before !== after) return { at, toPeak: after }
    }
  }

  return undefined
}
