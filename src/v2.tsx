import type { Context } from "@opencode/plugin/tui/context"
import { createPeakPlugin } from "./core.tsx"
import { isViewMode } from "./config.ts"
import { isLocale } from "./i18n.ts"
import { usesDeepSeek, type ModelRef } from "./model.ts"
import type { HostColors, PeakHost, Persisted, SelectInput } from "./host.ts"

type Prefs = {
  view?: string
  notify?: boolean
  locale?: string
}

function colorFrom(context: Context): HostColors {
  const theme = context.theme
  return {
    peak: theme.text.feedback.error.base,
    soon: theme.text.feedback.warning.base,
    offpeak: theme.text.feedback.success.base,
    muted: theme.text.muted,
    border: theme.border.base,
    panel: theme.background.raised.base,
  }
}

function sessionRefs(context: Context, sessionID: string): ModelRef[] {
  const refs: ModelRef[] = []
  for (const message of context.data.session.message.list(sessionID)) {
    if (message.type === "assistant" || message.type === "model-switched") {
      refs.push({ providerID: message.model.providerID, modelID: message.model.id })
    }
  }
  const info = context.data.session.get(sessionID)
  if (info?.model) refs.push({ providerID: info.model.providerID, modelID: info.model.id })
  return refs
}

function configuredModel(context: Context): string | undefined {
  const current = context.ui.model.current()
  return current ? `${current.providerID}/${current.modelID}` : undefined
}

export const setup = (context: Context): (() => void) => {
  const [prefs, updatePrefs] = context.storage.store<Prefs>("prefs", { initial: {} })
  let commandRegistered = false

  const host: PeakHost = {
    options: context.options,
    now: () => new Date(),
    interval: (ms, run) => {
      const timer = setInterval(run, ms)
      return () => clearInterval(timer)
    },
    storage: {
      get: (): Persisted | undefined => ({
        view: isViewMode(prefs.view) ? prefs.view : undefined,
        notify: typeof prefs.notify === "boolean" ? prefs.notify : undefined,
        locale: typeof prefs.locale === "string" && isLocale(prefs.locale) ? prefs.locale : undefined,
      }),
      set: (next) => {
        void updatePrefs((draft) => {
          if (next.view) draft.view = next.view
          if (typeof next.notify === "boolean") draft.notify = next.notify
          if (next.locale) draft.locale = next.locale
        })
      },
    },
    activeSessionID: () => {
      const route = context.ui.router.current()
      return route.type === "session" ? route.sessionID : undefined
    },
    usesDeepSeek: (sessionID) => usesDeepSeek(sessionRefs(context, sessionID), configuredModel(context)),
    sidebar: (render) =>
      context.ui.slot({
        append: "sidebar.content",
        render: ({ sessionID }) =>
          render({
            sessionID,
            colors: colorFrom(context),
            isDeepSeek: () => usesDeepSeek(sessionRefs(context, sessionID), configuredModel(context)),
          }),
      }),
    command: ({ id, title, slash, run }) => {
      if (commandRegistered) return () => {}
      commandRegistered = true
      // The keymap provider mounts with the UI, after setup. Registering the
      // layer from inside a slot render keeps it inside that provider's tree.
      context.ui.slot({
        append: "app",
        render: () => {
          context.keymap.layer(() => ({
            mode: "global",
            commands: [{ id, title: title(), palette: true, slash: { name: slash }, run: () => run() }],
          }))
          return null
        },
      })
      return () => {}
    },
    toast: ({ message, variant }) => context.ui.toast.show({ message, variant }),
    select: <Value,>(input: SelectInput<Value>) =>
      context.ui.dialog.select<Value>({
        title: input.title,
        options: input.options,
        ...(input.current === undefined ? {} : { current: input.current }),
      }),
  }

  return createPeakPlugin(host)
}
