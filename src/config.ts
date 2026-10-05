import { BUILTIN_HOLIDAYS } from "./holidays.ts"
import {
  DEFAULT_DAYS,
  DEFAULT_WINDOWS,
  isPeakWindow,
  type PeakWindow,
  type Schedule,
  type Weekday,
} from "./schedule.ts"

export type ViewMode = "box" | "line"

export type Settings = {
  schedule: Schedule
  view: ViewMode
  notify: boolean
}

export function isViewMode(value: unknown): value is ViewMode {
  return value === "box" || value === "line"
}

const WINDOW_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/
const HOLIDAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function matchMinutes(match: RegExpExecArray): number {
  return Number(match[1]) * 60 + Number(match[2])
}

function parseWindows(value: unknown): readonly PeakWindow[] {
  if (!Array.isArray(value)) return DEFAULT_WINDOWS
  if (value.length === 0) return []

  const windows: PeakWindow[] = []
  for (const entry of value) {
    if (!Array.isArray(entry) || entry.length !== 2) continue

    const [from, to] = entry
    if (typeof from !== "string" || typeof to !== "string") continue

    const fromMatch = WINDOW_PATTERN.exec(from)
    const toMatch = WINDOW_PATTERN.exec(to)
    if (!fromMatch || !toMatch) continue

    const candidate = { from: matchMinutes(fromMatch), to: matchMinutes(toMatch) }
    if (!isPeakWindow(candidate)) continue

    windows.push(candidate)
  }

  return windows.length > 0 ? windows : DEFAULT_WINDOWS
}

function parseDays(value: unknown): ReadonlySet<Weekday> {
  if (!Array.isArray(value)) return new Set(DEFAULT_DAYS)
  if (value.length === 0) return new Set()

  const days = value.filter(
    (day): day is Weekday => typeof day === "number" && Number.isInteger(day) && day >= 1 && day <= 7,
  )
  return days.length > 0 ? new Set(days) : new Set(DEFAULT_DAYS)
}

function parseHoliday(entry: string): string | undefined {
  const match = HOLIDAY_PATTERN.exec(entry)
  if (!match) return undefined

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return undefined
  }
  return entry
}

function parseHolidays(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  const holidays: string[] = []
  for (const entry of value) {
    if (typeof entry !== "string") continue
    const key = parseHoliday(entry)
    if (key) holidays.push(key)
  }
  return holidays
}

export function optionLocale(options: unknown): string | undefined {
  return isRecord(options) && typeof options.locale === "string" ? options.locale : undefined
}

export function parseSettings(options: unknown): Settings {
  const root = isRecord(options) ? options : {}
  const raw = isRecord(root.schedule) ? root.schedule : {}

  const holidays = new Set(parseHolidays(raw.holidays))
  if (raw.builtinHolidays !== false) {
    for (const key of BUILTIN_HOLIDAYS) holidays.add(key)
  }

  return {
    schedule: {
      windows: parseWindows(raw.windows),
      days: parseDays(raw.days),
      holidays,
    },
    view: isViewMode(root.view) ? root.view : "box",
    notify: root.notify === true,
  }
}
