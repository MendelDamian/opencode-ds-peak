import { Plugin } from "@opencode/plugin"

/**
 * OpenCode v2 package entry. The plugin has no server-side behavior; this
 * entrypoint exists so `opencode plugin add opencode-ds-peak` resolves the
 * package, and the CLI then loads the `./tui` component automatically.
 */
export default Plugin.define({
  id: "opencode-ds-peak.server",
  setup() {},
})
