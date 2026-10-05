export type ModelRef = {
  readonly providerID: string
  readonly modelID: string
}

export function isDeepSeek(ref: ModelRef): boolean {
  return `${ref.providerID} ${ref.modelID}`.toLowerCase().includes("deepseek")
}

export function configuredIsDeepSeek(configuredModel?: string): boolean {
  if (typeof configuredModel !== "string" || !configuredModel.includes("/")) return false
  const [providerID = "", ...rest] = configuredModel.split("/")
  return isDeepSeek({ providerID, modelID: rest.join("/") })
}

/**
 * Decides from an ordered list of candidate model refs, newest last. Falls back
 * to the configured `provider/model` string when the session has no refs yet.
 */
export function usesDeepSeek(refs: readonly ModelRef[], configuredModel?: string): boolean {
  const last = refs.at(-1)
  return last ? isDeepSeek(last) : configuredIsDeepSeek(configuredModel)
}
