import { en } from "./locales/en.ts"
import { pl } from "./locales/pl.ts"
import { es } from "./locales/es.ts"
import { de } from "./locales/de.ts"
import { zh } from "./locales/zh.ts"

const LOCALES = ["en", "pl", "es", "de", "zh"] as const

export type Locale = (typeof LOCALES)[number]

export type MessageKey = "peak" | "offpeak" | "nextIn" | "durationHm" | "durationM" | "durationLt"

export type Messages = Record<MessageKey, string>

export type Translate = (key: MessageKey, params?: Record<string, string | number>) => string

const CATALOGS: Record<Locale, Messages> = { en, pl, es, de, zh }

const TAGS = {
  en: "en-US",
  pl: "pl-PL",
  es: "es-ES",
  de: "de-DE",
  zh: "zh-CN",
} satisfies Record<Locale, string>

function isLocale(value: string): value is Locale {
  return LOCALES.some((locale) => locale === value)
}

export function detectLocale(input: unknown): Locale {
  const fromOption = typeof input === "string" && input.trim() ? input : undefined
  const fromEnv =
    typeof process !== "undefined"
      ? process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG
      : undefined
  const raw = (fromOption ?? fromEnv ?? "en").toLowerCase().split(".").at(0) ?? ""
  const base = raw.replace("_", "-").split("-").at(0) ?? ""
  return isLocale(base) ? base : "en"
}

function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : placeholder,
  )
}

export function translate(locale: Locale, key: MessageKey, params?: Record<string, string | number>): string {
  const template = CATALOGS[locale][key]
  return params ? interpolate(template, params) : template
}

export type I18n = {
  locale: Locale
  tag: (typeof TAGS)[Locale]
  t: Translate
}

export function createI18n(input?: unknown): I18n {
  const locale = detectLocale(input)
  return {
    locale,
    tag: TAGS[locale],
    t: (key, params) => translate(locale, key, params),
  }
}
