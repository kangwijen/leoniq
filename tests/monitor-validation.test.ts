import assert from "node:assert/strict"
import test from "node:test"
import {
  validateHttpUrl,
  validateMonitorTiming,
  validateTcpTarget,
} from "@/lib/monitor/validation"

test("validateHttpUrl accepts public https url", () => {
  const result = validateHttpUrl("https://example.com/health")
  assert.equal(result.ok, true)
})

test("validateHttpUrl blocks private localhost", () => {
  const result = validateHttpUrl("http://127.0.0.1:3000")
  assert.equal(result.ok, false)
})

test("validateTcpTarget blocks invalid port", () => {
  const result = validateTcpTarget("example.com", 70000)
  assert.equal(result.ok, false)
})

test("validateMonitorTiming enforces bounds", () => {
  assert.equal(validateMonitorTiming(20, 1000).ok, false)
  assert.equal(validateMonitorTiming(60, 400).ok, false)
  assert.equal(validateMonitorTiming(60, 5000).ok, true)
})
