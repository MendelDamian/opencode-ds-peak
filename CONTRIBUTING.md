# Contributing

Thanks for taking a look. This project is a single OpenCode TUI plugin that
ships raw TypeScript, so the loop is short: edit, run the checks, load it
locally.

## Development setup

There is no build step. OpenCode transpiles the `.tsx` source at runtime.

```sh
git clone https://github.com/MendelDamian/opencode-ds-peak
cd opencode-ds-peak
npm install
npm run check   # tsc --noEmit + sanity tests
npm run sanity  # schedule, model detection and i18n tests only
npm run pack    # inspect what would be published
```

`npm run check` runs `tsc --noEmit` and the sanity suite, and is what CI runs on
every push and pull request.

## Install your local checkout

Point `tui.json` at the entry file with an absolute path:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    ["/absolute/path/to/opencode-ds-peak/src/tui.tsx", { "locale": "pl" }]
  ]
}
```

Restart OpenCode to pick up changes.

## Layout

| Path | Role |
| ---- | ---- |
| `src/tui.tsx` | Combined default export: `tui` (v1) and `setup` (v2) |
| `src/host.ts` | The `PeakHost` port shared by both adapters |
| `src/core.tsx` | Host-agnostic plugin core: settings, timer, toast, dialog, sidebar |
| `src/v1.tsx` | OpenCode v1 TUI adapter (`@opencode-ai/plugin/tui`) |
| `src/v2.tsx` | OpenCode v2 CLI adapter (`@opencode/plugin/tui`) |
| `src/index.ts` | OpenCode v2 server entrypoint (no behavior) |
| `src/config.ts` | Option parsing and validation |
| `src/schedule.ts` | Peak windows, transitions, holidays |
| `src/status.ts` | Tier and countdown text |
| `src/model.ts` | DeepSeek model detection |
| `src/i18n.ts` | Locale detection, catalogs, interpolation |
| `src/locales/<locale>.ts` | Message catalogs |
| `scripts/sanity-check.mjs` | Dependency-free sanity tests |

### One core, two hosts

`src/core.tsx` owns every behavior: settings, the countdown timer, the transition
toast, the `/peak` dialog and the sidebar block. Host differences live behind the
`PeakHost` port in `src/host.ts`. `src/v1.tsx` and `src/v2.tsx` implement that
port against their runtime's options, storage, events, slots, dialogs and theme.

When you add a feature, put the behavior in the core and extend `PeakHost` only
if the two hosts genuinely differ. Adding host-specific branching to the core is
the thing this layout exists to avoid.

Test against both hosts:

- **v1:** point `~/.config/opencode/tui.json` at `src/tui.tsx` (absolute path)
  and restart OpenCode 1.18.
- **v2:** drop a file at
  `~/.config/opencode/plugins/opencode-ds-peak/tui.ts` that re-exports the
  entry, then restart OpenCode 2.0:

  ```ts
  export { default } from "/absolute/path/to/opencode-ds-peak/src/tui.tsx"
  ```

  Run `opencode --print-logs --log-level debug` and confirm the plugin reports
  `stage=setup` completed with no `plugin operation failed` line.

## Adding a language

1. Copy `src/locales/en.ts` to `src/locales/<locale>.ts` and translate the
   values.
2. Register it in `src/i18n.ts`: add the code to `LOCALES`, `CATALOGS`, and
   `TAGS`. The `Locale` type is derived from `LOCALES`.

A missing key is a TypeScript compile error.

## Model detection

A model counts as DeepSeek when the provider id or model id contains
`deepseek`, for example `deepseek/...`, `opencode/deepseek-v4.1-flash`, or
`openrouter/...deepseek...`. The sidebar block is hidden for every other model.

## Release process

Two workflows do the work:

- [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs typecheck + sanity
  on every push to `main` and every pull request.
- [`.github/workflows/publish.yml`](.github/workflows/publish.yml) runs when a
  `v*` tag is pushed, or manually via *Run workflow*. It re-runs the checks,
  verifies the tag matches `package.json`, publishes to npm with
  [trusted publishing](https://docs.npmjs.com/trusted-publishers), which uses
  OIDC instead of a long-lived token, and provenance, then creates a GitHub
  release.

### When to release

Release only when someone installing the package gets something different. The
package ships `src/`, the README, the license and `package.json`, so:

Release for:

- any `src/**` change: a fix, a feature, a new locale, a copy change
- consumer-visible `package.json` fields: `dependencies`, `peerDependencies`,
  `peerDependenciesMeta`, `engines`, `exports`, `files`

Do not release for:

- `.github/**`, including CI and Dependabot configuration
- `scripts/`, `tsconfig.json`, lockfile-only or formatting churn
- devDependency bumps, which never reach the tarball

Pick the bump:

- **patch** for a bug fix, or for widening a peer range. A compatibility bump is
  a patch even when the diff is one line.
- **minor** for a new feature, option or language.
- **major** for a breaking change, a raised minimum OpenCode version, or a
  dropped locale.

Time it:

- Release immediately when upstream OpenCode breaks the plugin API, however
  small the change.
- Otherwise batch user-facing work and tag when the batch is coherent. Do not
  tag per commit.
- Keep CI, docs and dependency housekeeping untagged so they ride along with the
  next real release.

`publish.yml` enforces the floor of this: a `v*` tag that changes neither
`src/**` nor the consumer-visible `package.json` surface fails before it can
publish.

### How to cut a release

```sh
npm version patch   # or minor / major; bumps package.json and creates vX.Y.Z
git push --follow-tags
```
