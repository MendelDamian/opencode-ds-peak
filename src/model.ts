export type ModelRef = {
  providerID?: string
  modelID?: string
  model?: { providerID?: string; modelID?: string }
}

export function isDeepSeek(providerID?: string, modelID?: string): boolean {
  return `${providerID ?? ""} ${modelID ?? ""}`.toLowerCase().includes("deepseek")
}

export function usesDeepSeek(messages: readonly ModelRef[], configuredModel?: string): boolean {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    const providerID = message.providerID ?? message.model?.providerID
    const modelID = message.modelID ?? message.model?.modelID
    if (providerID || modelID) return isDeepSeek(providerID, modelID)
  }

  if (typeof configuredModel === "string" && configuredModel.includes("/")) {
    const [providerID, ...rest] = configuredModel.split("/")
    return isDeepSeek(providerID, rest.join("/"))
  }

  return false
}
