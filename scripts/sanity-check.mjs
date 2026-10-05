import assert from "node:assert/strict"
import { isPeak, isPeakWindow, nextTransition, peakWindow } from "../src/schedule.ts"
import { describe, statusText } from "../src/status.ts"
import { parseSettings } from "../src/config.ts"
import { configuredIsDeepSeek, isDeepSeek, usesDeepSeek } from "../src/model.ts"
import { createI18n, detectLocale, formatDuration } from "../src/i18n.ts"

let failures = 0

function test(name, fn) {
  try {
    fn()
    console.log(`ok   ${name}`)
  } catch (error) {
    failures++
    console.error(`FAIL ${name}: ${error.message}`)
  }
}

const user = (providerID, modelID) => ({ role: "user", model: { providerID, modelID } })
const assistant = (providerID, modelID) => ({ role: "assistant", providerID, modelID })

const DEFAULT_SCHEDULE = parseSettings().schedule

test("weekday 02:30 UTC is peak", () => {
  assert.equal(isPeak(DEFAULT_SCHEDULE, new Date("2026-07-06T02:30:00Z")), true)
})

test("weekday 12:00 UTC is off-peak", () => {
  assert.equal(isPeak(DEFAULT_SCHEDULE, new Date("2026-07-06T12:00:00Z")), false)
})

test("weekend is always off-peak", () => {
  assert.equal(isPeak(DEFAULT_SCHEDULE, new Date("2026-07-11T09:30:00Z")), false)
})

test("built-in holiday on a weekday is off-peak", () => {
  assert.equal(isPeak(DEFAULT_SCHEDULE, new Date("2026-02-17T02:30:00Z")), false)
})

test("next transition from Monday 10:30Z is Tuesday 01:00Z to peak", () => {
  const next = nextTransition(DEFAULT_SCHEDULE, new Date("2026-07-06T10:30:00Z"))
  assert.equal(next?.at.toISOString(), "2026-07-07T01:00:00.000Z")
  assert.equal(next?.toPeak, true)
})

test("next transition skips the weekend", () => {
  const next = nextTransition(DEFAULT_SCHEDULE, new Date("2026-07-10T11:00:00Z"))
  assert.equal(next?.at.toISOString(), "2026-07-13T01:00:00.000Z")
  assert.equal(next?.toPeak, true)
})

test("next transition while peak goes off-peak", () => {
  const next = nextTransition(DEFAULT_SCHEDULE, new Date("2026-07-06T06:30:00Z"))
  assert.equal(next?.at.toISOString(), "2026-07-06T10:00:00.000Z")
  assert.equal(next?.toPeak, false)
})

test("peakWindow enforces from < to", () => {
  assert.equal(isPeakWindow({ from: 60, to: 60 }), false)
  assert.equal(isPeakWindow({ from: 240, to: 60 }), false)
  assert.equal(isPeakWindow({ from: 60, to: 240 }), true)
  assert.throws(() => peakWindow(240, 60))
})

test("next transition skips holiday Mondays", () => {
  const schedule = {
    windows: [peakWindow(0, 60)],
    days: new Set([1]),
    holidays: new Set(["2026-07-06", "2026-07-13"]),
  }
  const next = nextTransition(schedule, new Date("2026-07-04T00:30:00Z"))
  assert.equal(next?.at.toISOString(), "2026-07-20T00:00:00.000Z")
  assert.equal(next?.toPeak, true)
})

test("next transition survives the multi-day Spring Festival block", () => {
  const next = nextTransition(DEFAULT_SCHEDULE, new Date("2026-02-13T10:30:00Z"))
  assert.equal(next?.at.toISOString(), "2026-02-24T01:00:00.000Z")
  assert.equal(next?.toPeak, true)
})

test("next transition returns undefined when no windows are configured", () => {
  const schedule = { windows: [], days: new Set([1]), holidays: new Set() }
  assert.equal(nextTransition(schedule, new Date("2026-07-04T00:30:00Z")), undefined)
})

test("custom schedule marks only its window and day", () => {
  const schedule = { windows: [peakWindow(0, 60)], days: new Set([1]), holidays: new Set() }
  assert.equal(isPeak(schedule, new Date("2026-07-06T00:30:00Z")), true)
  assert.equal(isPeak(schedule, new Date("2026-07-06T01:30:00Z")), false)
})

test("describe marks a weekday holiday but not a weekend holiday", () => {
  assert.equal(describe(DEFAULT_SCHEDULE, new Date("2026-02-17T02:30:00Z")).tier, "holiday")
  assert.equal(describe(DEFAULT_SCHEDULE, new Date("2026-02-15T02:30:00Z")).tier, "offpeak")
})

test("statusText is empty without a next transition and formats with one", () => {
  const now = new Date("2026-07-06T10:30:00Z")
  const en = createI18n("en").t
  assert.equal(statusText({ tier: "offpeak", next: undefined }, now, en), "")
  assert.equal(statusText(describe(DEFAULT_SCHEDULE, now), now, en), "14h left")
})

test("parseSettings defaults to box, no notify, default schedule", () => {
  const settings = parseSettings()
  assert.equal(settings.view, "box")
  assert.equal(settings.notify, false)
  assert.equal(isPeak(settings.schedule, new Date("2026-07-06T02:30:00Z")), true)
  assert.equal(isPeak(settings.schedule, new Date("2026-02-17T02:30:00Z")), false)
})

test("parseSettings reads custom view, notify, windows, days and holidays", () => {
  const settings = parseSettings({
    view: "line",
    notify: true,
    schedule: {
      windows: [["00:00", "01:00"]],
      days: [1],
      builtinHolidays: false,
      holidays: ["2026-07-06"],
    },
  })
  assert.equal(settings.view, "line")
  assert.equal(settings.notify, true)
  assert.equal(isPeak(settings.schedule, new Date("2026-07-06T00:30:00Z")), false)
  assert.equal(isPeak(settings.schedule, new Date("2026-07-13T00:30:00Z")), true)
})

test("parseSettings drops invalid windows and keeps the valid ones", () => {
  const settings = parseSettings({ schedule: { windows: [["01:00", "04:00"], ["bad", "x"]] } })
  assert.equal(settings.schedule.windows.length, 1)
  assert.equal(isPeak(settings.schedule, new Date("2026-07-06T02:30:00Z")), true)
})

test("parseSettings treats an empty window list as no peak", () => {
  const settings = parseSettings({ schedule: { windows: [] } })
  assert.equal(settings.schedule.windows.length, 0)
  assert.equal(isPeak(settings.schedule, new Date("2026-07-06T02:30:00Z")), false)
  assert.equal(nextTransition(settings.schedule, new Date("2026-07-06T02:30:00Z")), undefined)
})

test("parseSettings drops impossible holiday dates", () => {
  const settings = parseSettings({
    schedule: { builtinHolidays: false, holidays: ["2026-13-45", "2026-02-31", "2026-02-28"] },
  })
  assert.deepEqual([...settings.schedule.holidays], ["2026-02-28"])
})

test("parseSettings can disable the built-in holiday table", () => {
  const settings = parseSettings({ schedule: { builtinHolidays: false } })
  assert.equal(settings.schedule.holidays.size, 0)
})

test("isDeepSeek matches provider or model id substring", () => {
  assert.equal(isDeepSeek({ providerID: "deepseek", modelID: "deepseek-chat" }), true)
  assert.equal(isDeepSeek({ providerID: "opencode", modelID: "deepseek-v4.1-flash" }), true)
  assert.equal(isDeepSeek({ providerID: "anthropic", modelID: "claude-sonnet-4-6" }), false)
})

test("usesDeepSeek reads the last message", () => {
  assert.equal(usesDeepSeek([assistant("deepseek", "deepseek-chat")]), true)
  assert.equal(usesDeepSeek([user("openrouter", "deepseek/deepseek-chat")]), true)
  assert.equal(
    usesDeepSeek([assistant("deepseek", "deepseek-chat"), assistant("anthropic", "claude-sonnet-4-6")]),
    false,
  )
})

test("usesDeepSeek falls back to the configured model", () => {
  assert.equal(usesDeepSeek([], "opencode/deepseek-v4.1-flash"), true)
  assert.equal(usesDeepSeek([], "anthropic/claude-sonnet-4-6"), false)
  assert.equal(usesDeepSeek([]), false)
})

test("configuredIsDeepSeek ignores bare model ids", () => {
  assert.equal(configuredIsDeepSeek("deepseek-chat"), false)
  assert.equal(configuredIsDeepSeek("opencode/deepseek-v4-pro"), true)
})

test("detectLocale keeps ISO codes and drops aliases", () => {
  assert.equal(detectLocale("pl_PL.UTF-8"), "pl")
  assert.equal(detectLocale("es-MX"), "es")
  assert.equal(detectLocale("zh_CN.UTF-8"), "zh")
  assert.equal(detectLocale("sp"), "en")
  assert.equal(detectLocale("cn"), "en")
})

test("formatDuration shows whole hours when an hour or more is left", () => {
  const pl = createI18n("pl").t
  assert.equal(formatDuration(11 * 3_600_000 + 8 * 60_000, pl), "11 godz.")
  assert.equal(formatDuration(2 * 3_600_000 + 5 * 60_000, pl), "2 godz.")
})

test("formatDuration shows minutes under an hour", () => {
  const pl = createI18n("pl").t
  assert.equal(formatDuration(43 * 60_000, pl), "43 min")
  assert.equal(formatDuration(30_000, pl), "<1 min")
})

test("formatDuration shows days past 24 hours", () => {
  const en = createI18n("en").t
  assert.equal(formatDuration(23 * 3_600_000, en), "23h")
  assert.equal(formatDuration(24 * 3_600_000, en), "1d")
  assert.equal(formatDuration(25 * 3_600_000, en), "1d 1h")
  assert.equal(formatDuration(63 * 3_600_000, en), "2d 15h")
})

test("countdown wording depends on state", () => {
  const en = createI18n("en").t
  assert.equal(en("peakIn", { time: "2h" }), "in 2h")
  assert.equal(en("offpeakLeft", { time: "2h" }), "2h left")
  const pl = createI18n("pl").t
  assert.equal(pl("peakIn", { time: "2 godz." }), "za 2 godz.")
  assert.equal(pl("offpeakLeft", { time: "2 godz." }), "jeszcze 2 godz.")
})

if (failures > 0) {
  console.error(`\n${failures} sanity check(s) failed`)
  process.exit(1)
}

console.log("\nall sanity checks passed")
