import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const SRC = join(ROOT, "src")

let failures = 0

function check(name, ok, detail) {
  if (ok) {
    console.log(`ok   ${name}`)
  } else {
    failures++
    console.error(`FAIL ${name}${detail ? `: ${detail}` : ""}`)
  }
}

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

// A shipped .tsx must declare its JSX import source. The published package has
// no tsconfig, so without the pragma the host transpiler falls back to react,
// which is not installed.
for (const file of walk(SRC).filter((f) => f.endsWith(".tsx"))) {
  const head = readFileSync(file, "utf8").split("\n").slice(0, 3).join("\n")
  check(
    `jsx import source: ${file.slice(ROOT.length + 1)}`,
    /@jsxImportSource\s+@opentui\/solid/.test(head),
    "add /** @jsxImportSource @opentui/solid */ as the first line",
  )
}

function run(command, args, options = {}) {
  return spawnSync(command, args, { encoding: "utf8", ...options })
}

const packed = run("npm", ["pack", "--json"], { cwd: ROOT })
let tarball
try {
  const report = JSON.parse(packed.stdout.slice(packed.stdout.indexOf("[")))
  tarball = join(ROOT, report[0].filename)
} catch {
  console.error("FAIL pack: could not read npm pack output")
  console.error(packed.stdout)
  console.error(packed.stderr)
  process.exit(1)
}
check("npm pack produces a tarball", Boolean(tarball))

const consumer = mkdtempSync(join(tmpdir(), "ds-peak-consumer-"))
try {
  writeFileSync(join(consumer, "package.json"), JSON.stringify({ name: "consumer", private: true, type: "module" }))

  const install = run("npm", ["install", "--no-audit", "--no-fund", tarball, "tsx"], { cwd: consumer })
  check("npm install into a clean consumer", install.status === 0, install.stderr)

  // Loads both entrypoints the way OpenCode does. v1 reads the `tui` key, v2
  // reads `setup`, and the package root is the v2 server entry.
  writeFileSync(
    join(consumer, "check.mts"),
    `const tui = (await import("opencode-ds-peak/tui")).default
const server = (await import("opencode-ds-peak")).default
const problems = []
if (typeof tui?.id !== "string") problems.push("tui export has no id")
if (typeof tui?.tui !== "function") problems.push("v1 entry: tui is not a function")
if (typeof tui?.setup !== "function") problems.push("v2 entry: setup is not a function")
if (typeof server?.setup !== "function") problems.push("server entry: setup is not a function")
if (problems.length > 0) {
  console.error(problems.join("\\n"))
  process.exit(1)
}
console.log("loaded " + tui.id + ": tui=" + typeof tui.tui + " setup=" + typeof tui.setup)
`,
  )

  const load = run(join(consumer, "node_modules", ".bin", "tsx"), ["check.mts"], { cwd: consumer })
  check("load tui (v1 and v2) and server entries from the packed artifact", load.status === 0, `${load.stdout}${load.stderr}`)
  if (load.status === 0) console.log(`      ${load.stdout.trim()}`)
} finally {
  rmSync(consumer, { recursive: true, force: true })
}

if (failures > 0) {
  console.error(`\n${failures} package check(s) failed`)
  process.exit(1)
}
console.log("\npackage installs and loads for OpenCode v1 and v2")
