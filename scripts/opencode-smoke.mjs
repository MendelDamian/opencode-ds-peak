import { spawn } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const PLUGIN = "opencode-ds-peak"

function arg(name, fallback) {
  const index = process.argv.indexOf(name)
  return index === -1 ? fallback : process.argv[index + 1]
}

const target = arg("--target")
if (target !== "v1" && target !== "v2") {
  console.error("usage: node scripts/opencode-smoke.mjs --target v1|v2 [--bin <opencode>]")
  process.exit(2)
}
const bin = arg("--bin", "opencode")
const timeoutMs = Number(arg("--timeout", "120000"))

function run(command, args, options = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], ...options })
    let out = ""
    child.stdout.on("data", (data) => (out += data))
    child.stderr.on("data", (data) => (out += data))
    child.on("close", (code) => resolvePromise({ code, out }))
  })
}

function shellQuote(value) {
  return `'${value.replaceAll("'", `'\\''`)}'`
}

// Loads the packed package through the real OpenCode host. A wrapper imports
// the installed entry and writes a marker the moment the host calls it, so the
// check proves the host loaded the package rather than that the import worked.
function wrapper(entry, key) {
  return `import { writeFileSync } from "node:fs"
import plugin from ${JSON.stringify(entry)}
const marker = process.env.OPENCODE_SMOKE_MARKER
export default {
  ...plugin,
  ${key}: async (...args) => {
    if (marker) writeFileSync(marker, "loaded")
    return plugin[${JSON.stringify(key)}](...args)
  },
}
`
}

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))

async function waitForMarker(marker, child, ms) {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    if (existsSync(marker)) return true
    if (child.exitCode !== null) return existsSync(marker)
    await sleep(1000)
  }
  return existsSync(marker)
}

async function main() {
  const root = mkdtempSync(join(tmpdir(), "opencode-smoke-"))
  const consumer = join(root, "consumer")
  const home = join(root, "home")
  const marker = join(root, "marker")
  mkdirSync(consumer, { recursive: true })
  mkdirSync(join(home, ".config", "opencode"), { recursive: true })

  try {
    writeFileSync(join(consumer, "package.json"), JSON.stringify({ name: "consumer", private: true, type: "module" }))

    const pack = await run("npm", ["pack", "--silent", "--pack-destination", root], { cwd: ROOT })
    const tarball = join(root, pack.out.trim().split("\n").filter(Boolean).pop())
    if (!existsSync(tarball)) throw new Error(`npm pack produced no tarball: ${pack.out}`)

    const install = await run("npm", ["install", "--no-audit", "--no-fund", tarball], { cwd: consumer })
    if (install.code !== 0) throw new Error(`npm install failed:\n${install.out}`)

    const entry = join(consumer, "node_modules", PLUGIN, "src", "tui.tsx")
    if (!existsSync(entry)) throw new Error(`installed entry missing: ${entry}`)

    if (target === "v1") {
      const probe = join(home, ".config", "opencode", "smoke-probe.ts")
      writeFileSync(probe, wrapper(entry, "tui"))
      writeFileSync(
        join(home, ".config", "opencode", "tui.json"),
        JSON.stringify({ $schema: "https://opencode.ai/tui.json", plugin: [probe] }, null, 2),
      )
    } else {
      const dir = join(home, ".config", "opencode", "plugins", PLUGIN)
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, "tui.ts"), wrapper(entry, "setup"))
    }

    const command = target === "v2" ? `${shellQuote(bin)} --standalone --print-logs --log-level debug` : `${shellQuote(bin)}`
    const pty =
      process.platform === "darwin"
        ? ["script", ["-q", "/dev/null", "sh", "-c", command]]
        : ["script", ["-qec", command, "/dev/null"]]

    const env = {
      ...process.env,
      HOME: home,
      XDG_CONFIG_HOME: join(home, ".config"),
      XDG_DATA_HOME: join(home, ".local", "share"),
      XDG_CACHE_HOME: join(home, ".cache"),
      XDG_STATE_HOME: join(home, ".local", "state"),
      OPENCODE_SMOKE_MARKER: marker,
      NO_COLOR: "1",
    }

    const child = spawn(pty[0], pty[1], { env, stdio: ["ignore", "pipe", "pipe"] })
    let output = ""
    child.stdout.on("data", (data) => (output += data))
    child.stderr.on("data", (data) => (output += data))

    const loaded = await waitForMarker(marker, child, timeoutMs)
    child.kill("SIGTERM")
    await sleep(500)
    if (child.exitCode === null) child.kill("SIGKILL")

    const markerText = existsSync(marker) ? readFileSync(marker, "utf8") : ""
    const failed = /plugin operation failed/.test(output)

    if (!loaded || markerText !== "loaded") {
      console.error(`FAIL ${target}: OpenCode did not load ${PLUGIN}`)
      console.error("--- captured output (tail) ---")
      console.error(output.split("\n").slice(-40).join("\n"))
      process.exit(1)
    }
    if (failed) {
      console.error(`FAIL ${target}: OpenCode reported a plugin failure`)
      console.error(output.split("\n").filter((line) => line.includes("plugin operation failed")).join("\n"))
      process.exit(1)
    }
    console.log(`ok   OpenCode ${target} installed and loaded ${PLUGIN}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(`FAIL ${target}: ${error.message}`)
  process.exit(1)
})
