import assert from "node:assert/strict"
import { isPeak, nextTransition } from "../src/schedule.ts"
import { configuredIsDeepSeek, isDeepSeek, usesDeepSeek } from "../src/model.ts"

let failures = 0

function test(name, fn) {
  try {
    fn()
    console.log(`ok   ${name}`)
  } catch (error) {
    failures++
    console.error(`FAIL ${name}: ${error.message}`)
  }
}

const user = (providerID, modelID) => ({ role: "user", model: { providerID, modelID } })
const assistant = (providerID, modelID) => ({ role: "assistant", providerID, modelID })

test("weekday 02:30 UTC is peak", () => {
  assert.equal(isPeak(new Date("2026-07-06T02:30:00Z")), true)
})

test("weekday 12:00 UTC is off-peak", () => {
  assert.equal(isPeak(new Date("2026-07-06T12:00:00Z")), false)
})

test("weekend is always off-peak", () => {
  assert.equal(isPeak(new Date("2026-07-11T09:30:00Z")), false)
})

test("next transition from Monday 10:30Z is Tuesday 01:00Z to peak", () => {
  const next = nextTransition(new Date("2026-07-06T10:30:00Z"))
  assert.equal(next.at.toISOString(), "2026-07-07T01:00:00.000Z")
  assert.equal(next.toPeak, true)
})

test("next transition skips the weekend", () => {
  const next = nextTransition(new Date("2026-07-10T11:00:00Z"))
  assert.equal(next.at.toISOString(), "2026-07-13T01:00:00.000Z")
  assert.equal(next.toPeak, true)
})

test("next transition while peak goes off-peak", () => {
  const next = nextTransition(new Date("2026-07-06T06:30:00Z"))
  assert.equal(next.at.toISOString(), "2026-07-06T10:00:00.000Z")
  assert.equal(next.toPeak, false)
})

test("isDeepSeek matches provider or model id substring", () => {
  assert.equal(isDeepSeek({ providerID: "deepseek", modelID: "deepseek-chat" }), true)
  assert.equal(isDeepSeek({ providerID: "opencode", modelID: "deepseek-v4.1-flash" }), true)
  assert.equal(isDeepSeek({ providerID: "anthropic", modelID: "claude-sonnet-4-6" }), false)
})

test("usesDeepSeek reads the last message", () => {
  assert.equal(usesDeepSeek([assistant("deepseek", "deepseek-chat")]), true)
  assert.equal(usesDeepSeek([user("openrouter", "deepseek/deepseek-chat")]), true)
  assert.equal(
    usesDeepSeek([assistant("deepseek", "deepseek-chat"), assistant("anthropic", "claude-sonnet-4-6")]),
    false,
  )
})

test("usesDeepSeek falls back to the configured model", () => {
  assert.equal(usesDeepSeek([], "opencode/deepseek-v4.1-flash"), true)
  assert.equal(usesDeepSeek([], "anthropic/claude-sonnet-4-6"), false)
  assert.equal(usesDeepSeek([]), false)
})

test("configuredIsDeepSeek ignores bare model ids", () => {
  assert.equal(configuredIsDeepSeek("deepseek-chat"), false)
  assert.equal(configuredIsDeepSeek("opencode/deepseek-v4-pro"), true)
})

if (failures > 0) {
  console.error(`\n${failures} sanity check(s) failed`)
  process.exit(1)
}

console.log("\nall sanity checks passed")
