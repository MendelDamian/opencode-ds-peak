/** @jsxImportSource @opentui/solid */
import { createSignal, onCleanup } from "solid-js"
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { isViewMode, parseSettings, type ViewMode } from "./config.ts"
import {
  createI18n,
  formatDuration,
  isLocale,
  LOCALES,
  LOCALE_NAMES,
  translate,
  type Locale,
  type Translate,
} from "./i18n.ts"
import { usesDeepSeek } from "./model.ts"
import { SOON_MS } from "./schedule.ts"
import { describe, statusText, type Tier } from "./status.ts"

const DOT = "\u25CF"
const PLUGIN_ID = "opencode-ds-peak"
const VIEW_KEY = `${PLUGIN_ID}.view`
const NOTIFY_KEY = `${PLUGIN_ID}.notify`
const LOCALE_KEY = `${PLUGIN_ID}.locale`

const tui: TuiPlugin = async (api, options) => {
  const settings = parseSettings(options)

  const [view, setView] = createSignal<ViewMode>(settings.view)
  const [notify, setNotify] = createSignal(settings.notify)
  const [locale, setLocale] = createSignal<Locale>(createI18n(options?.locale).locale)
  const t: Translate = (key, params) => translate(locale(), key, params)
  const [tier, setTier] = createSignal<Tier>("offpeak")
  const [soon, setSoon] = createSignal(false)
  const [remaining, setRemaining] = createSignal("")

  let hydrated = false
  const hydrate = () => {
    if (hydrated || !api.kv.ready) return
    const storedView = api.kv.get(VIEW_KEY)
    if (isViewMode(storedView)) setView(storedView)
    const storedNotify = api.kv.get(NOTIFY_KEY)
    if (typeof storedNotify === "boolean") setNotify(storedNotify)
    const storedLocale = api.kv.get(LOCALE_KEY)
    if (typeof storedLocale === "string" && isLocale(storedLocale) && storedLocale !== locale()) {
      setLocale(storedLocale)
      registerCommand()
    }
    hydrated = true
  }

  const activeSessionID = (): string | undefined => {
    const route = api.route.current
    if (route.name !== "session" || !route.params) return undefined
    const sessionID = route.params.sessionID
    return typeof sessionID === "string" ? sessionID : undefined
  }

  const sessionUsesDeepSeek = (sessionID: string) =>
    usesDeepSeek(api.state.session.messages(sessionID), api.state.config?.model)

  const openPeakDialog = (anchor?: string) => {
    const now = new Date()
    const current = describe(settings.schedule, now)
    const state =
      current.tier === "holiday" ? t("holiday") : current.tier === "peak" ? t("peak") : t("offpeak")
    const when = current.next ? formatDuration(current.next.at.getTime() - now.getTime(), t) : undefined
    const items = [
      { title: t("commandNow", { state }), value: "now", disabled: true },
      ...(when ? [{ title: t("commandNext", { when }), value: "next", disabled: true }] : []),
      {
        title: t("commandView", { mode: view() === "box" ? t("viewBox") : t("viewLine") }),
        value: "view",
        onSelect: () => {
          const nextView = view() === "box" ? "line" : "box"
          setView(nextView)
          api.kv.set(VIEW_KEY, nextView)
          openPeakDialog("view")
        },
      },
      {
        title: t("commandNotify", { state: notify() ? t("stateOn") : t("stateOff") }),
        value: "notify",
        onSelect: () => {
          const nextNotify = !notify()
          setNotify(nextNotify)
          api.kv.set(NOTIFY_KEY, nextNotify)
          openPeakDialog("notify")
        },
      },
      {
        title: t("commandLanguage", { language: LOCALE_NAMES[locale()] }),
        value: "language",
        onSelect: () => openLanguageDialog(),
      },
    ]
    api.ui.dialog.replace(() => (
      <api.ui.DialogSelect title={t("commandTitle")} current={anchor} options={items} />
    ))
  }

  const selectLocale = (code: Locale) => {
    if (code !== locale()) {
      setLocale(code)
      api.kv.set(LOCALE_KEY, code)
      registerCommand()
      tick()
    }
    openPeakDialog("language")
  }

  const openLanguageDialog = () => {
    const items = LOCALES.map((code) => ({
      title: LOCALE_NAMES[code],
      value: code,
      onSelect: () => selectLocale(code),
    }))
    api.ui.dialog.replace(() => (
      <api.ui.DialogSelect title={t("commandLanguageTitle")} current={locale()} options={items} />
    ))
  }

  let disposeCommand: (() => void) | undefined
  const registerCommand = () => {
    disposeCommand?.()
    disposeCommand = api.keymap.registerLayer({
      commands: [
        {
          name: `${PLUGIN_ID}.peak`,
          title: t("commandTitle"),
          namespace: "palette",
          slashName: "peak",
          run() {
            openPeakDialog()
          },
        },
      ],
    })
  }
  registerCommand()
  api.lifecycle.onDispose(() => disposeCommand?.())

  let lastPeak: boolean | undefined
  const tick = () => {
    hydrate()

    const now = new Date()
    const current = describe(settings.schedule, now)
    const nowPeak = current.tier === "peak"
    const id = activeSessionID()
    const enabled = id !== undefined && sessionUsesDeepSeek(id)

    if (notify() && enabled && lastPeak !== undefined && nowPeak !== lastPeak) {
      api.ui.toast({
        variant: nowPeak ? "warning" : "success",
        message: nowPeak ? t("toastPeakStart") : t("toastPeakEnd"),
      })
    }
    lastPeak = nowPeak

    setTier(current.tier)
    setRemaining(statusText(current, now, t))
    setSoon(current.tier !== "peak" && current.next?.toPeak === true && current.next.at.getTime() - now.getTime() <= SOON_MS)
  }

  tick()
  const timer = setInterval(tick, 60_000)
  api.lifecycle.onDispose(() => clearInterval(timer))

  api.slots.register({
    order: 90,
    slots: {
      sidebar_content(ctx, value) {
        const active = () => sessionUsesDeepSeek(value.session_id)
        const [enabled, setEnabled] = createSignal(active())

        const refresh = () => setEnabled(active())
        refresh()
        const unsubscribe = api.event.on("message.updated", refresh)
        onCleanup(unsubscribe)

        const tone = () => {
          if (tier() === "peak") return ctx.theme.current.error
          if (soon()) return ctx.theme.current.warning
          return ctx.theme.current.success
        }

        const label = () => (tier() === "holiday" ? t("holiday") : tier() === "peak" ? t("peak") : t("offpeak"))

        if (!enabled()) return null

        if (view() === "line") {
          return (
            <box flexDirection="row">
              <text fg={tone()}>
                <b>
                  {DOT} {label()}
                </b>
              </text>
              {remaining() ? <text fg={ctx.theme.current.textMuted}> {remaining()}</text> : null}
            </box>
          )
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
                {DOT} {label()}
              </b>
            </text>
            {remaining() ? <text fg={ctx.theme.current.textMuted}>{remaining()}</text> : null}
          </box>
        )
      },
    },
  })
}

const plugin: TuiPluginModule & { id: string } = {
  id: PLUGIN_ID,
  tui,
}

export default plugin
