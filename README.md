# opencode-ds-peak

An [OpenCode](https://opencode.ai) TUI plugin that renders a small block in the
sidebar showing whether the DeepSeek API is currently in **peak** (full price)
or **off-peak** (half price) billing, plus a countdown to the next switch.

DeepSeek prices are defined in UTC, so this plugin computes the window in UTC
and renders times in your local time zone. Daylight saving is handled
automatically.

The block is only visible while the active session uses a DeepSeek model. A
model counts as DeepSeek when the provider id or model id contains `deepseek`
(for example `deepseek/...`, `opencode/deepseek-v4.1-flash`, or
`openrouter/...deepseek...`). For every other model the sidebar stays clean.

```
┌────────────────────┐
│ ● OFF-PEAK         │
│ 8h left            │
└────────────────────┘
```

The dot is green during off-peak, red during peak, and yellow when peak starts
within 30 minutes. The second line counts down to the next switch and is worded
by state: during peak it reads "in {time}" (off-peak starting), during off-peak
"{time} left". An hour or more shows whole hours; under an hour shows minutes.
The Polish catalogs use "za {time}" (peak) and "jeszcze {time}" (off-peak).

| Status   | Meaning                          |
| -------- | -------------------------------- |
| `PEAK`   | full price (roughly morning/night, Mon–Fri) |
| `OFF-PEAK` | half price (afternoon, evening, night, all weekend) |

## Schedule

Peak hours are `01:00–04:00` and `06:00–10:00` UTC, Monday through Friday.
Everything else is off-peak, including weekends and Chinese public holidays.

For reference, in Poland this is roughly:

| Season       | Peak (local)          | Off-peak (local)            |
| ------------ | --------------------- | --------------------------- |
| Summer (CEST) | 03:00–06:00, 08:00–12:00 | 12:00–03:00 + weekends/holidays |
| Winter (CET)  | 02:00–05:00, 07:00–11:00 | 11:00–02:00 + weekends/holidays |

## Install

### From a local path (development)

Clone this repo, install dependencies, then point `tui.json` at the entry file.

```sh
git clone https://github.com/MendelDamian/opencode-ds-peak
cd opencode-ds-peak
npm install
```

Add the plugin to `~/.config/opencode/tui.json` (global) or
`.opencode/tui.json` (project):

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    ["/absolute/path/to/opencode-ds-peak/src/tui.tsx", { "locale": "pl" }]
  ]
}
```

Restart OpenCode. Open the sidebar with `<leader>b` (default `ctrl+x`, then
`b`). The block appears above the built-in context section.

### From npm

Add it to `tui.json`:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [["opencode-ds-peak", { "locale": "pl" }]]
}
```

Or install with the CLI, which writes the config entry for you:

```sh
opencode plugin opencode-ds-peak -g
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

One-time setup on npmjs.com: add a **Trusted Publisher** for `opencode-ds-peak`
with owner `MendelDamian`, repository `opencode-ds-peak`, and workflow
`publish.yml`. Before the package exists, configure it as a pending publisher,
or publish `0.1.0` once manually with `npm publish`.

The package ships raw `.tsx` source; opencode's runtime transpiles it, so there
is no build step.

## Configuration

| Option   | Type   | Default            | Description |
| -------- | ------ | ------------------ | ----------- |
| `locale` | string | system locale      | UI language. One of `en`, `pl`, `es`, `de`, `zh`. Detected from `LC_ALL` / `LC_MESSAGES` / `LANG` when omitted, falling back to `en`. |

## Languages

`en` (English), `pl` (Polski), `es` (Español), `de` (Deutsch), `zh` (中文).

The i18n layer is hand-rolled and dependency-free — only the built-in `Intl`
API plus plain message catalogs. Catalogs live in `src/locales/<locale>.ts`;
the runtime (locale detection, fallback to English, `{placeholder}`
interpolation) lives in `src/i18n.ts`. To add a language:

1. Copy `src/locales/en.ts` to `src/locales/<locale>.ts` and translate the values.
2. Register it in `src/i18n.ts`: add the code to `LOCALES`, `CATALOGS`, and
   `TAGS`. The `Locale` type is derived from `LOCALES`.

A missing key is a TypeScript compile error.

## Notes

- Chinese public holidays are not detected automatically; on those days
  DeepSeek is off-peak but this plugin will report peak.
- The block refreshes every 60 seconds.

## License

MIT
