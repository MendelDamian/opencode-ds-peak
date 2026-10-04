/** @jsxImportSource @opentui/solid */
import { createSignal, onCleanup } from "solid-js"
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { createI18n } from "./i18n.ts"
import type { Translate } from "./i18n.ts"
import { usesDeepSeek } from "./model.ts"

const BOUNDARY_HOURS = [1, 4, 6, 10]
const SOON_MS = 30 * 60_000
const DOT = "\u25CF"

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

function formatRemaining(ms: number, t: Translate): string {
  const total = Math.max(0, Math.floor(ms / 60_000))
  const h = Math.floor(total / 60)
  const m = total % 60

  if (total < 1) return t("durationLt")
  return h > 0 ? t("durationHm", { h, m }) : t("durationM", { m })
}

const tui: TuiPlugin = async (api, options) => {
  const { t } = createI18n(options?.locale)

  api.slots.register({
    order: 90,
    slots: {
      sidebar_content(ctx, value) {
        const active = () => usesDeepSeek(api.state.session.messages(value.session_id), api.state.config?.model)
        const [enabled, setEnabled] = createSignal(active())
        const [peak, setPeak] = createSignal(isPeak())
        const [soon, setSoon] = createSignal(false)
        const [remaining, setRemaining] = createSignal("")

        const refresh = () => setEnabled(active())

        const tick = () => {
          const now = new Date()
          const next = nextTransition(now)
          refresh()
          setPeak(isPeak(now))
          setSoon(!isPeak(now) && next.toPeak && next.at.getTime() - now.getTime() <= SOON_MS)
          setRemaining(formatRemaining(next.at.getTime() - now.getTime(), t))
        }

        tick()
        const timer = setInterval(tick, 60_000)
        const unsubscribe = api.event.on("message.updated", refresh)
        onCleanup(() => {
          clearInterval(timer)
          unsubscribe()
        })

        const tone = () => {
          if (peak()) return ctx.theme.current.error
          if (soon()) return ctx.theme.current.warning
          return ctx.theme.current.success
        }

        return enabled() ? (
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
                {DOT} {peak() ? t("peak") : t("offpeak")}
              </b>
            </text>
            <text fg={ctx.theme.current.textMuted}>{t("nextIn", { time: remaining() })}</text>
          </box>
        ) : null
      },
    },
  })
}

const plugin: TuiPluginModule & { id: string } = {
  id: "deepseek-peak-sidebar",
  tui,
}

export default plugin
