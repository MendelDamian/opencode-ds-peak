# opencode-ds-peak

[![npm version](https://img.shields.io/npm/v/opencode-ds-peak.svg)](https://www.npmjs.com/package/opencode-ds-peak)
[![npm downloads](https://img.shields.io/npm/dm/opencode-ds-peak.svg)](https://www.npmjs.com/package/opencode-ds-peak)
[![CI](https://github.com/MendelDamian/opencode-ds-peak/actions/workflows/ci.yml/badge.svg)](https://github.com/MendelDamian/opencode-ds-peak/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/opencode-ds-peak.svg)](https://github.com/MendelDamian/opencode-ds-peak/blob/main/LICENSE)

**Know at a glance whether DeepSeek is charging full price or half price right now.**

DeepSeek bills full price during *peak* hours and half price the rest of the
time. This [OpenCode](https://opencode.ai) TUI plugin puts a small, live block in
the sidebar so you always know where you stand — and how long until it changes.

```
┌────────────────────┐
│ ● OFF-PEAK         │
│ 8h left            │
└────────────────────┘
```

## Why

- **Half price isn't advertised in the moment.** The switch happens silently;
  this block makes it obvious.
- **A countdown, not a table.** "8h left" tells you whether to send that big
  request now or wait.
- **Out of the way.** The block only appears while the active session uses a
  DeepSeek model. On any other model the sidebar stays clean.

## Features

- Colour-coded status: green off-peak, red peak, yellow when peak starts within
  30 minutes.
- Live countdown to the next switch, refreshed every 60 seconds. Shows whole
  hours when an hour or more is left, minutes below that.
- State-aware wording: while peaking it reads "in 3h" (off-peak starting);
  while off-peak, "8h left".
- Five languages: English, Polski, Español, Deutsch, 中文.
- Detects your locale automatically.
- No runtime dependencies — hand-rolled i18n, ships raw `.tsx`.

## Schedule

Peak hours are `01:00–04:00` and `06:00–10:00` UTC, Monday through Friday.
Everything else is off-peak, including weekends and Chinese public holidays.

Prices are defined in UTC, so the plugin computes the window in UTC and renders
in your local time zone. Daylight saving is handled automatically. For
reference, in Poland that works out to:

| Season        | Peak (local)             | Off-peak (local)                |
| ------------- | ------------------------ | ------------------------------- |
| Summer (CEST) | 03:00–06:00, 08:00–12:00 | 12:00–03:00 + weekends/holidays |
| Winter (CET)  | 02:00–05:00, 07:00–11:00 | 11:00–02:00 + weekends/holidays |

## Install

### From npm (recommended)

Add it to `~/.config/opencode/tui.json` (global) or `.opencode/tui.json`
(project):

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [["opencode-ds-peak", { "locale": "pl" }]]
}
```

Or let the CLI write the config entry for you:

```sh
opencode plugin opencode-ds-peak -g
```

Restart OpenCode and open the sidebar with your leader key plus `b` (default
`ctrl+x`, then `b`). The block appears above the built-in context section.

### From source (development)

```sh
git clone https://github.com/MendelDamian/opencode-ds-peak
cd opencode-ds-peak
npm install
```

Then point `tui.json` at the entry file (absolute path):

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    ["/absolute/path/to/opencode-ds-peak/src/tui.tsx", { "locale": "pl" }]
  ]
}
```

## Configuration

| Option   | Type   | Default       | Description |
| -------- | ------ | ------------- | ----------- |
| `locale` | string | system locale | UI language. One of `en`, `pl`, `es`, `de`, `zh`. Detected from `LC_ALL` / `LC_MESSAGES` / `LANG` when omitted, falling back to `en`. |

## Languages

`en` (English), `pl` (Polski), `es` (Español), `de` (Deutsch), `zh` (中文).

The i18n layer is hand-rolled and dependency-free — plain message catalogs plus
the built-in `Intl` API. Catalogs live in `src/locales/<locale>.ts`; locale
detection, English fallback and `{placeholder}` interpolation live in
`src/i18n.ts`. To add a language:

1. Copy `src/locales/en.ts` to `src/locales/<locale>.ts` and translate the values.
2. Register it in `src/i18n.ts`: add the code to `LOCALES`, `CATALOGS`, and
   `TAGS`. The `Locale` type is derived from `LOCALES`.

A missing key is a TypeScript compile error.

## Notes

- Chinese public holidays are not detected automatically; on those days
  DeepSeek is off-peak but this plugin will report peak.
- A model counts as DeepSeek when the provider id or model id contains
  `deepseek` (for example `deepseek/...`, `opencode/deepseek-v4.1-flash`, or
  `openrouter/...deepseek...`).

## Development

```sh
npm run check   # tsc --noEmit + sanity tests
npm run sanity  # schedule, model detection and i18n tests only
```

## Publishing

Two workflows:

- [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs typecheck + sanity
  on every push to `main` and every pull request.
- [`.github/workflows/publish.yml`](.github/workflows/publish.yml) runs when a
  `v*` tag is pushed (or manually via *Run workflow*). It re-runs the checks,
  verifies the tag matches `package.json`, publishes to npm with
  [trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC, no
  long-lived token) and provenance, then creates a GitHub release.

To cut a release:

```sh
npm version patch   # or minor / major — bumps package.json and creates vX.Y.Z
git push --follow-tags
```

No build step — the package ships raw `.tsx` source and OpenCode transpiles it
at runtime.

## License

MIT
