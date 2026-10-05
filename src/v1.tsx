/** @jsxImportSource @opentui/solid */
import { createSignal, onCleanup } from "solid-js"
import type { TuiPlugin, TuiPluginApi } from "@opencode-ai/plugin/tui"
import { createPeakPlugin } from "./core.tsx"
import { isViewMode } from "./config.ts"
import { isLocale } from "./i18n.ts"
import { usesDeepSeek, type ModelRef } from "./model.ts"
import type { CommandInput, HostColors, PeakHost, Persisted, SelectInput } from "./host.ts"

const VIEW_KEY = "opencode-ds-peak.view"
const NOTIFY_KEY = "opencode-ds-peak.notify"
const LOCALE_KEY = "opencode-ds-peak.locale"

type HostMessage = ReturnType<TuiPluginApi["state"]["session"]["messages"]>[number]

function colorFrom(theme: TuiPluginApi["theme"]): HostColors {
  const current = theme.current
  return {
    peak: current.error,
    soon: current.warning,
    offpeak: current.success,
    muted: current.textMuted,
    border: current.border,
    panel: current.backgroundPanel,
  }
}

function modelRef(message: HostMessage): ModelRef | undefined {
  switch (message.role) {
    case "user":
      return { providerID: message.model.providerID, modelID: message.model.modelID }
    case "assistant":
      return { providerID: message.providerID, modelID: message.modelID }
    default:
      return undefined
  }
}

function sessionRefs(api: TuiPluginApi, sessionID: string): ModelRef[] {
  const refs: ModelRef[] = []
  for (const message of api.state.session.messages(sessionID)) {
    const ref = modelRef(message)
    if (ref) refs.push(ref)
  }
  return refs
}

function isDeepSeekSession(api: TuiPluginApi, sessionID: string): boolean {
  return usesDeepSeek(sessionRefs(api, sessionID), api.state.config?.model)
}

export const v1: TuiPlugin = async (api, options) => {
  const host: PeakHost = {
    options,
    now: () => new Date(),
    interval: (ms, run) => {
      const timer = setInterval(run, ms)
      const removeDispose = api.lifecycle.onDispose(() => clearInterval(timer))
      return () => {
        clearInterval(timer)
        removeDispose()
      }
    },
    storage: {
      get: (): Persisted | undefined => {
        if (!api.kv.ready) return undefined
        const view = api.kv.get(VIEW_KEY)
        const notify = api.kv.get(NOTIFY_KEY)
        const locale = api.kv.get(LOCALE_KEY)
        return {
          view: isViewMode(view) ? view : undefined,
          notify: typeof notify === "boolean" ? notify : undefined,
          locale: typeof locale === "string" && isLocale(locale) ? locale : undefined,
        }
      },
      set: (next) => {
        if (next.view) api.kv.set(VIEW_KEY, next.view)
        if (typeof next.notify === "boolean") api.kv.set(NOTIFY_KEY, next.notify)
        if (next.locale) api.kv.set(LOCALE_KEY, next.locale)
      },
    },
    activeSessionID: () => {
      const route = api.route.current
      const params = route.name === "session" ? route.params : undefined
      const id = params?.sessionID
      return typeof id === "string" ? id : undefined
    },
    usesDeepSeek: (sessionID) => isDeepSeekSession(api, sessionID),
    sidebar: (render) => {
      api.slots.register({
        order: 90,
        slots: {
          sidebar_content(ctx, value) {
            const [enabled, setEnabled] = createSignal(isDeepSeekSession(api, value.session_id))
            const unsubscribe = api.event.on("message.updated", () => {
              setEnabled(isDeepSeekSession(api, value.session_id))
            })
            onCleanup(unsubscribe)
            return render({
              sessionID: value.session_id,
              colors: colorFrom(ctx.theme),
              isDeepSeek: enabled,
            })
          },
        },
      })
      return () => {}
    },
    command: ({ id, title, slash, run }: CommandInput) =>
      api.keymap.registerLayer({
        commands: [{ name: id, title: title(), namespace: "palette", slashName: slash, run: () => run() }],
      }),
    toast: ({ message, variant }) => api.ui.toast({ message, variant }),
    select: <Value,>(input: SelectInput<Value>) =>
      new Promise<Value | undefined>((resolve) => {
        api.ui.dialog.replace(() => (
          <api.ui.DialogSelect
            title={input.title}
            current={input.current}
            options={input.options.map((option) => ({
              title: option.title,
              value: option.value,
              disabled: option.disabled ?? false,
              onSelect: () => resolve(option.value),
            }))}
          />
        ))
      }),
  }

  createPeakPlugin(host)
}
