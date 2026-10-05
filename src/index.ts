import type { Plugin } from "@opencode/plugin"

/**
 * OpenCode v2 package entry. The plugin has no server-side behavior; this
 * entrypoint exists so `opencode plugin add opencode-ds-peak` resolves the
 * package, and the CLI then loads the `./tui` component automatically.
 *
 * `@opencode/plugin` is imported as a type only. A runtime import would force
 * every install to carry it, and an optional peer is not installed, which made
 * the server entry fail.
 */
const server = {
  id: "opencode-ds-peak.server",
  setup() {},
} satisfies Plugin.Plugin

export default server
