/** @jsxImportSource @opentui/solid */
import { v1 } from "./v1.tsx"
import { setup } from "./v2.tsx"

const PLUGIN_ID = "opencode-ds-peak"

/**
 * Dual-target TUI plugin.
 *
 * OpenCode v1 reads `tui`; OpenCode v2 reads `setup`. Each loader ignores the
 * other key, so one package serves both runtimes. Both adapters share the same
 * core logic through the {@link PeakHost} port.
 */
const plugin = {
  id: PLUGIN_ID,
  tui: v1,
  setup,
}

export default plugin
