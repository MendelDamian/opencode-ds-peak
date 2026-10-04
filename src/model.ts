import type { TuiPluginApi } from "@opencode-ai/plugin/tui"

export type HostMessage = ReturnType<TuiPluginApi["state"]["session"]["messages"]>[number]

export type ModelRef = {
  providerID: string
  modelID: string
}

export function isDeepSeek(ref: ModelRef): boolean {
  return `${ref.providerID} ${ref.modelID}`.toLowerCase().includes("deepseek")
}

function modelRef(message: HostMessage): ModelRef {
  switch (message.role) {
    case "user":
      return { providerID: message.model.providerID, modelID: message.model.modelID }
    case "assistant":
      return { providerID: message.providerID, modelID: message.modelID }
    default: {
      const _exhaustive: never = message
      return _exhaustive
    }
  }
}

export function configuredIsDeepSeek(configuredModel?: string): boolean {
  if (typeof configuredModel !== "string" || !configuredModel.includes("/")) return false
  const [providerID = "", ...rest] = configuredModel.split("/")
  return isDeepSeek({ providerID, modelID: rest.join("/") })
}

export function usesDeepSeek(messages: readonly HostMessage[], configuredModel?: string): boolean {
  const last = messages.at(-1)
  return last ? isDeepSeek(modelRef(last)) : configuredIsDeepSeek(configuredModel)
}
