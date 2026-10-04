# opencode-ds-peak

An [OpenCode](https://opencode.ai) TUI plugin that renders a small block in the
sidebar showing whether the DeepSeek API is currently in **peak** (full price)
or **off-peak** (half price) billing, plus a countdown to the next switch.

DeepSeek prices are defined in UTC, so this plugin computes the window in UTC
and renders times in your local time zone. Daylight saving is handled
automatically.

```
┌────────────────────┐
│ ● OFF-PEAK         │
│ next in 1h 40m     │
└────────────────────┘
```

The dot is green during off-peak, red during peak, and yellow when peak starts
within 30 minutes. The second line counts down to the next switch (peak →
off-peak, or off-peak → peak).

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

## Publishing (maintainers)

```sh
npm login              # once, opens the browser
npm version patch      # or minor / major
npm publish            # publishes to npm
```

The package ships raw `.tsx` source; opencode's runtime transpiles it, so there
is no build step.

## Configuration

| Option   | Type   | Default            | Description |
| -------- | ------ | ------------------ | ----------- |
| `locale` | string | system locale      | UI language. One of `en`, `pl`, `es`, `de`, `zh`. Detected from `LC_ALL` / `LC_MESSAGES` / `LANG` when omitted, falling back to `en`. |

## Languages

`en` (English), `pl` (Polski), `es` (Español), `de` (Deutsch), `zh` (中文).

## Notes

- Chinese public holidays are not detected automatically; on those days
  DeepSeek is off-peak but this plugin will report peak.
- The block refreshes every 60 seconds.

## License

MIT
