# opencode-ds-peak

[![npm version](https://img.shields.io/npm/v/opencode-ds-peak.svg)](https://www.npmjs.com/package/opencode-ds-peak)
[![npm downloads](https://img.shields.io/npm/dm/opencode-ds-peak.svg)](https://www.npmjs.com/package/opencode-ds-peak)
[![CI](https://github.com/MendelDamian/opencode-ds-peak/actions/workflows/ci.yml/badge.svg)](https://github.com/MendelDamian/opencode-ds-peak/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/opencode-ds-peak.svg)](https://github.com/MendelDamian/opencode-ds-peak/blob/main/LICENSE)

**See whether DeepSeek is charging full or half price right now.**

DeepSeek charges full price during peak hours and half price the rest of the
time. This OpenCode TUI plugin adds a small live block to your sidebar showing
the current price tier and how long until the next switch.

<table>
<tr>
<th align="left">box</th>
<th align="left">line</th>
</tr>
<tr>
<td><pre>┌────────────────────┐
│ ● OFF-PEAK         │
│ 8h left            │
└────────────────────┘</pre></td>
<td><pre>● OFF-PEAK 8h left</pre></td>
</tr>
</table>

It runs with no configuration. The block follows your OpenCode language, uses
DeepSeek's published schedule, and only appears in sessions that use a DeepSeek
model.

## Install

Run the CLI:

```sh
opencode plugin opencode-ds-peak -g
```

Or add the entry yourself — `~/.config/opencode/tui.json` for every project, or
`.opencode/tui.json` for one:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": ["opencode-ds-peak"]
}
```

Restart OpenCode, then open the sidebar with your leader key plus `b` (default
`ctrl+x`, then `b`). The block appears above the built-in context section.

## Why

- **The switch is silent.** DeepSeek changes price without notice. The block
  states the current tier so you do not have to track the schedule.
- **A countdown.** The block shows the time until the next switch, so you can
  decide whether to wait.
- **Only for DeepSeek sessions.** The block appears when the active session uses
  a DeepSeek model and hides otherwise.

## Features

- The status dot is green off-peak, red at peak, and yellow when peak starts
  within 30 minutes.
- The countdown updates every 60 seconds. It shows whole days past 24 hours,
  whole hours past one, and minutes below that.
- The wording follows the state. During peak it reads "in 3h"; during off-peak,
  "8h left".
- A compact one-line mode. It drops the box and shows the dot with the label.
- Chinese public holidays are off-peak. A built-in table covers 2026, and you
  can add your own dates.
- The schedule is configurable. Override the peak windows, the weekdays, and the
  holiday list.
- Optional notifications. A single toast fires when the price tier flips while a
  DeepSeek session is active, even when the sidebar is closed.
- A `/peak` command. It shows the current tier and the next switch, and changes
  the view, the notifications, and the language.
- Five languages: English, Polish, Spanish, German, and Chinese. The plugin
  detects your locale.
- No runtime dependencies. The i18n layer is hand-rolled and the package ships
  raw `.tsx`.

## Schedule

Peak hours are `01:00–04:00` and `06:00–10:00` UTC, Monday through Friday.
Everything else is off-peak, including weekends and Chinese public holidays.

The built-in holiday table covers China 2026. DeepSeek follows the Chinese
holiday calendar, so a weekday holiday is off-peak. Add dates for other years
through the `schedule.holidays` option, or turn the table off with
`schedule.builtinHolidays: false`.

The label reads `HOLIDAY` only on a working-day holiday. On a holiday that falls
on a weekend it stays `OFF-PEAK`, since the day is off-peak either way.

Prices are defined in UTC, so the plugin computes the window in UTC and renders
it in your local time zone. The plugin handles daylight saving. For reference,
in Poland that works out to:

| Season        | Peak (local)             | Off-peak (local)                |
| ------------- | ------------------------ | ------------------------------- |
| Summer (CEST) | 03:00–06:00, 08:00–12:00 | 12:00–03:00 + weekends/holidays |
| Winter (CET)  | 02:00–05:00, 07:00–11:00 | 11:00–02:00 + weekends/holidays |

## Configuration

Every option is optional. These are the defaults:

| Option                    | Type       | Default                          | Description |
| ------------------------- | ---------- | -------------------------------- | ----------- |
| `locale`                  | string     | system locale                    | UI language. One of `en`, `pl`, `es`, `de`, `zh`. Detected from `LC_ALL`, `LC_MESSAGES` or `LANG` when omitted, falling back to `en`. |
| `view`                    | string     | `box`                            | `box` for the bordered block, `line` for a single compact line. |
| `notify`                  | boolean    | `false`                          | Show a toast when the tier flips while a DeepSeek session is active. |
| `schedule.days`           | number[]   | `[1,2,3,4,5]`                    | Peak weekdays as ISO numbers, `1` for Monday through `7` for Sunday. |
| `schedule.windows`        | string[][] | `[["01:00","04:00"],["06:00","10:00"]]` | Peak windows as `[from, to]` `HH:MM` UTC pairs. Half-open, so `to` is the first off-peak minute. |
| `schedule.holidays`       | string[]   | `[]`                             | Extra off-peak dates as `YYYY-MM-DD` UTC keys. |
| `schedule.builtinHolidays`| boolean    | `true`                           | Include the built-in China 2026 holiday table. |

A full example:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    [
      "opencode-ds-peak",
      {
        "locale": "pl",
        "view": "line",
        "notify": true,
        "schedule": {
          "days": [1, 2, 3, 4, 5],
          "windows": [["01:00", "04:00"], ["06:00", "10:00"]],
          "holidays": ["2026-12-25"]
        }
      }
    ]
  ]
}
```

Bad values fall back to the default for that field. A window or day list keeps
its valid entries and falls back to the default only when none are valid. An
empty window or day list means peak never applies, which is how you pin the
plugin off-peak. An invalid holiday date is dropped.

## Command

Run `/peak` from the command palette. It opens a menu with the current tier and
the next switch, plus settings:

- **Sidebar** switches between `box` and `line`.
- **Notifications** turns the transition toast on or off.
- **Language** opens a list of the five UI languages.

The settings persist and override the matching config option.

## Languages

English `en`, Polish `pl`, Spanish `es`, German `de`, Chinese `zh`. Pick a
language from `/peak`; the choice persists and overrides the `locale` option.

The i18n layer is hand-rolled and dependency-free. It uses plain message
catalogs plus the built-in `Intl` API. Catalogs live in
`src/locales/<locale>.ts`; locale detection, English fallback and
`{placeholder}` interpolation live in `src/i18n.ts`. To add a language:

1. Copy `src/locales/en.ts` to `src/locales/<locale>.ts` and translate the values.
2. Register it in `src/i18n.ts`: add the code to `LOCALES`, `CATALOGS`, and
   `TAGS`. The `Locale` type is derived from `LOCALES`.

A missing key is a TypeScript compile error.

## Notes

- A model counts as DeepSeek when the provider id or model id contains
  `deepseek`, for example `deepseek/...`, `opencode/deepseek-v4.1-flash`, or
  `openrouter/...deepseek...`.

## Install from source

```sh
git clone https://github.com/MendelDamian/opencode-ds-peak
cd opencode-ds-peak
npm install
```

Then point `tui.json` at the entry file with an absolute path:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    ["/absolute/path/to/opencode-ds-peak/src/tui.tsx", { "locale": "pl" }]
  ]
}
```

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
  `v*` tag is pushed, or manually via *Run workflow*. It re-runs the checks,
  verifies the tag matches `package.json`, publishes to npm with
  [trusted publishing](https://docs.npmjs.com/trusted-publishers), which uses
  OIDC instead of a long-lived token, and provenance, then creates a GitHub
  release.

To cut a release:

```sh
npm version patch   # or minor / major; bumps package.json and creates vX.Y.Z
git push --follow-tags
```

There is no build step. The package ships raw `.tsx` source and OpenCode
transpiles it at runtime.

## License

MIT
