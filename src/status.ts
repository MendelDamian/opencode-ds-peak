import { formatDuration, type Translate } from "./i18n.ts"
import { isObservedHoliday, isPeak, nextTransition, type Schedule, type Transition } from "./schedule.ts"

export type Tier = "peak" | "holiday" | "offpeak"

export type Status = {
  tier: Tier
  next: Transition | undefined
}

export function describe(schedule: Schedule, now: Date = new Date()): Status {
  const tier: Tier = isPeak(schedule, now)
    ? "peak"
    : isObservedHoliday(schedule, now)
      ? "holiday"
      : "offpeak"
  return { tier, next: nextTransition(schedule, now) }
}

export function statusText(status: Status, now: Date, t: Translate): string {
  if (!status.next) return ""

  const time = formatDuration(status.next.at.getTime() - now.getTime(), t)
  return status.tier === "peak" ? t("peakIn", { time }) : t("offpeakLeft", { time })
}
