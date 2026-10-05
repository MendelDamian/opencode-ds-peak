import type { RGBA } from "@opentui/core"
import type { JSX } from "@opentui/solid"
import type { ViewMode } from "./config.ts"
import type { Locale } from "./i18n.ts"

/** A usable color value. Both the v1 and v2 themes expose OpenTUI colors. */
export type Color = string | RGBA

export type HostColors = {
  readonly peak: Color
  readonly soon: Color
  readonly offpeak: Color
  readonly muted: Color
  readonly border: Color
  readonly panel: Color
}

/** The slice of user state the plugin persists. Every field is optional so a
 * host that has not finished loading storage can answer "not ready yet". */
export type Persisted = {
  readonly view?: ViewMode | undefined
  readonly notify?: boolean | undefined
  readonly locale?: Locale | undefined
}

export type SelectOption<Value> = {
  readonly title: string
  readonly value: Value
  readonly disabled?: boolean
}

export type SidebarInput = {
  readonly sessionID: string
  readonly colors: HostColors
  /** Reactive accessor: wrap it in JSX so the host re-renders on model change. */
  readonly isDeepSeek: () => boolean
}

export type CommandInput = {
  readonly id: string
  /** Reactive accessor so a language change relabels the palette entry. */
  readonly title: () => string
  readonly slash: string
  readonly run: () => void
}

export type ToastInput = {
  readonly message: string
  readonly variant: "success" | "warning"
}

export type SelectInput<Value> = {
  readonly title: string
  readonly current?: Value | undefined
  readonly options: readonly SelectOption<Value>[]
}

/**
 * The port between the shared plugin core and a host runtime.
 *
 * The core owns all pricing, schedule, i18n and UI-flow logic. Each host
 * (OpenCode v1 TUI, OpenCode v2 CLI) supplies the capabilities that differ by
 * runtime: option source, persistence, events, slots, dialogs and theme.
 */
export type PeakHost = {
  readonly options: unknown
  now(): Date
  interval(ms: number, run: () => void): () => void
  readonly storage: {
    get(): Persisted | undefined
    set(next: Persisted): void
  }
  activeSessionID(): string | undefined
  usesDeepSeek(sessionID: string): boolean
  sidebar(render: (input: SidebarInput) => JSX.Element): () => void
  command(input: CommandInput): () => void
  toast(input: ToastInput): void
  select<Value>(input: SelectInput<Value>): Promise<Value | undefined>
}
