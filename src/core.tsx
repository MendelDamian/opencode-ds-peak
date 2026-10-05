/** @jsxImportSource @opentui/solid */
import { createSignal } from "solid-js"
import { optionLocale, parseSettings, type ViewMode } from "./config.ts"
import {
  createI18n,
  formatDuration,
  LOCALE_NAMES,
  LOCALES,
  translate,
  type Locale,
  type Translate,
} from "./i18n.ts"
import { describe, statusText, type Tier } from "./status.ts"
import { SOON_MS } from "./schedule.ts"
import type { HostColors, PeakHost, Persisted, SidebarInput } from "./host.ts"

const DOT = "\u25CF"
const TICK_MS = 60_000

/**
 * The host-agnostic plugin core. It wires settings, the countdown timer, the
 * transition toast, the `/peak` dialog and the sidebar block onto a {@link PeakHost}.
 *
 * Returns a cleanup function the adapter should run on unload.
 */
export function createPeakPlugin(host: PeakHost): () => void {
  const settings = parseSettings(host.options)
  const [view, setView] = createSignal<ViewMode>(settings.view)
  const [notify, setNotify] = createSignal(settings.notify)
  const [locale, setLocale] = createSignal<Locale>(createI18n(optionLocale(host.options)).locale)
  const [tier, setTier] = createSignal<Tier>("offpeak")
  const [soon, setSoon] = createSignal(false)
  const [remaining, setRemaining] = createSignal("")

  const t: Translate = (key, params) => translate(locale(), key, params)

  const snapshot = (): Persisted => ({ view: view(), notify: notify(), locale: locale() })

  const persist = (next: Persisted) => {
    host.storage.set({ ...snapshot(), ...next })
  }

  let hydrated = false
  const hydrate = () => {
    if (hydrated) return
    const saved = host.storage.get()
    if (!saved) return
    if (saved.view) setView(saved.view)
    if (typeof saved.notify === "boolean") setNotify(saved.notify)
    if (saved.locale && saved.locale !== locale()) {
      setLocale(saved.locale)
      registerCommand()
    }
    hydrated = true
  }

  let lastPeak: boolean | undefined
  const tick = () => {
    hydrate()

    const now = host.now()
    const current = describe(settings.schedule, now)
    const peakNow = current.tier === "peak"
    const id = host.activeSessionID()
    const enabled = id !== undefined && host.usesDeepSeek(id)

    if (notify() && enabled && lastPeak !== undefined && peakNow !== lastPeak) {
      host.toast({
        message: peakNow ? t("toastPeakStart") : t("toastPeakEnd"),
        variant: peakNow ? "warning" : "success",
      })
    }
    lastPeak = peakNow

    setTier(current.tier)
    setRemaining(statusText(current, now, t))
    setSoon(
      current.tier !== "peak" &&
        current.next?.toPeak === true &&
        current.next.at.getTime() - now.getTime() <= SOON_MS,
    )
  }

  const openLanguage = async (): Promise<void> => {
    const choice = await host.select<Locale>({
      title: t("commandLanguageTitle"),
      current: locale(),
      options: LOCALES.map((code) => ({ title: LOCALE_NAMES[code], value: code })),
    })
    if (choice && choice !== locale()) {
      setLocale(choice)
      persist({ locale: choice })
      registerCommand()
      tick()
    }
    return openDialog("language")
  }

  const openDialog = async (anchor?: string): Promise<void> => {
    const now = host.now()
    const current = describe(settings.schedule, now)
    const state =
      current.tier === "holiday" ? t("holiday") : current.tier === "peak" ? t("peak") : t("offpeak")
    const when = current.next ? formatDuration(current.next.at.getTime() - now.getTime(), t) : undefined

    const choice = await host.select<string>({
      title: t("commandTitle"),
      current: anchor,
      options: [
        { title: t("commandNow", { state }), value: "now", disabled: true },
        ...(when ? [{ title: t("commandNext", { when }), value: "next", disabled: true }] : []),
        {
          title: t("commandView", { mode: view() === "box" ? t("viewBox") : t("viewLine") }),
          value: "view",
        },
        { title: t("commandNotify", { state: notify() ? t("stateOn") : t("stateOff") }), value: "notify" },
        { title: t("commandLanguage", { language: LOCALE_NAMES[locale()] }), value: "language" },
      ],
    })

    switch (choice) {
      case "view": {
        const next: ViewMode = view() === "box" ? "line" : "box"
        setView(next)
        persist({ view: next })
        return openDialog("view")
      }
      case "notify": {
        const next = !notify()
        setNotify(next)
        persist({ notify: next })
        return openDialog("notify")
      }
      case "language":
        return openLanguage()
      default:
        return
    }
  }

  let disposeCommand: (() => void) | undefined
  const registerCommand = () => {
    disposeCommand?.()
    disposeCommand = host.command({
      id: "opencode-ds-peak.peak",
      title: () => t("commandTitle"),
      slash: "peak",
      run: () => void openDialog(),
    })
  }

  const label = () =>
    tier() === "holiday" ? t("holiday") : tier() === "peak" ? t("peak") : t("offpeak")

  const tone = (colors: HostColors) => (tier() === "peak" ? colors.peak : soon() ? colors.soon : colors.offpeak)

  const render = (input: SidebarInput) => {
    if (!input.isDeepSeek()) return null

    if (view() === "line") {
      return (
        <box flexDirection="row">
          <text fg={tone(input.colors)}>
            <b>{`${DOT} ${label()}`}</b>
          </text>
          {remaining() ? <text fg={input.colors.muted}>{` ${remaining()}`}</text> : null}
        </box>
      )
    }

    return (
      <box
        border
        borderColor={input.colors.border}
        backgroundColor={input.colors.panel}
        paddingTop={1}
        paddingBottom={1}
        paddingLeft={2}
        paddingRight={2}
        flexDirection="column"
      >
        <text fg={tone(input.colors)}>
          <b>{`${DOT} ${label()}`}</b>
        </text>
        {remaining() ? <text fg={input.colors.muted}>{remaining()}</text> : null}
      </box>
    )
  }

  registerCommand()
  tick()
  const stopTimer = host.interval(TICK_MS, tick)
  const stopSidebar = host.sidebar(render)

  return () => {
    disposeCommand?.()
    stopSidebar()
    stopTimer()
  }
}
