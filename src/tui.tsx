/** @jsxImportSource @opentui/solid */
import { createSignal, onCleanup } from "solid-js"
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"

type Locale = "en" | "pl" | "es" | "de" | "zh"

type Strings = {
  peak: string
  offpeak: string
  next: string
}

const STRINGS: Record<Locale, Strings> = {
  en: { peak: "PEAK", offpeak: "OFF-PEAK", next: "next in" },
  pl: { peak: "PEAK", offpeak: "OFF-PEAK", next: "za" },
  es: { peak: "PICO", offpeak: "VALLE", next: "próximo en" },
  de: { peak: "PEAK", offpeak: "OFF-PEAK", next: "nächster in" },
  zh: { peak: "高峰", offpeak: "低谷", next: "还有" },
}

const INTL: Record<Locale, string> = {
  en: "en-US",
  pl: "pl-PL",
  es: "es-ES",
  de: "de-DE",
  zh: "zh-CN",
}

const ALIASES: Record<string, Locale> = {
  en: "en",
  pl: "pl",
  es: "es",
  sp: "es",
  de: "de",
  zh: "zh",
  cn: "zh",
}

const BOUNDARY_HOURS = [1, 4, 6, 10]
const SOON_MS = 30 * 60_000
const DOT = "\u25CF"

function detectLocale(input: unknown): Locale {
  const fromOption = typeof input === "string" && input.trim() ? input : undefined
  const fromEnv =
    typeof process !== "undefined"
      ? process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG
      : undefined
  const raw = (fromOption ?? fromEnv ?? "en").toLowerCase().split(".")[0]
  const base = raw.replace("_", "-").split("-")[0]
  return ALIASES[base] ?? "en"
}

function isPeak(date = new Date()): boolean {
  const day = date.getUTCDay()
  if (day === 0 || day === 6) return false

  const hour = date.getUTCHours()
  return (hour >= 1 && hour < 4) || (hour >= 6 && hour < 10)
}

function nextTransition(from = new Date()): { at: Date; toPeak: boolean } {
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

function formatRemaining(ms: number, locale: Locale): string {
  const total = Math.max(0, Math.floor(ms / 60_000))
  const h = Math.floor(total / 60)
  const m = total % 60

  if (total < 1) {
    return locale === "zh" ? "<1分" : "<1m"
  }

  switch (locale) {
    case "pl":
      return h > 0 ? `${h} godz. ${m} min` : `${m} min`
    case "de":
      return h > 0 ? `${h} Std. ${m} Min.` : `${m} Min.`
    case "zh":
      return h > 0 ? `${h}小时${m}分` : `${m}分`
    default:
      return h > 0 ? `${h}h ${m}m` : `${m}m`
  }
}

const tui: TuiPlugin = async (api, options) => {
  const locale = detectLocale(options?.locale)
  const strings = STRINGS[locale]

  api.slots.register({
    order: 90,
    slots: {
      sidebar_content(ctx) {
        const [peak, setPeak] = createSignal(isPeak())
        const [soon, setSoon] = createSignal(false)
        const [remaining, setRemaining] = createSignal("")

        const tick = () => {
          const now = new Date()
          const next = nextTransition(now)
          setPeak(isPeak(now))
          setSoon(!isPeak(now) && next.toPeak && next.at.getTime() - now.getTime() <= SOON_MS)
          setRemaining(formatRemaining(next.at.getTime() - now.getTime(), locale))
        }

        tick()
        const timer = setInterval(tick, 60_000)
        onCleanup(() => clearInterval(timer))

        const tone = () => {
          if (peak()) return ctx.theme.current.error
          if (soon()) return ctx.theme.current.warning
          return ctx.theme.current.success
        }

        return (
          <box
            border
            borderColor={ctx.theme.current.border}
            backgroundColor={ctx.theme.current.backgroundPanel}
            paddingTop={1}
            paddingBottom={1}
            paddingLeft={2}
            paddingRight={2}
            flexDirection="column"
          >
            <text fg={tone()}>
              <b>
                {DOT} {peak() ? strings.peak : strings.offpeak}
              </b>
            </text>
            <text fg={ctx.theme.current.textMuted}>
              {strings.next} {remaining()}
            </text>
          </box>
        )
      },
    },
  })
}

const plugin: TuiPluginModule & { id: string } = {
  id: "deepseek-peak-sidebar",
  tui,
}

export default plugin
