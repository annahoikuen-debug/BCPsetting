import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { checkRateLimit, clearRateLimit } from "@/lib/rate-limit"

describe("checkRateLimit (レート制限ユーティリティ)", () => {
  beforeEach(() => {
    clearRateLimit("user1")
    clearRateLimit("user2")
  })

  afterEach(() => {
    clearRateLimit("user1")
    clearRateLimit("user2")
  })

  it("制限内のリクエストは allowed=true を返し、remaining が減少する", () => {
    const r1 = checkRateLimit("user1", 3, 60 * 1000)
    expect(r1.allowed).toBe(true)
    expect(r1.remaining).toBe(2)

    const r2 = checkRateLimit("user1", 3, 60 * 1000)
    expect(r2.allowed).toBe(true)
    expect(r2.remaining).toBe(1)

    const r3 = checkRateLimit("user1", 3, 60 * 1000)
    expect(r3.allowed).toBe(true)
    expect(r3.remaining).toBe(0)
  })

  it("制限を超えたリクエストは allowed=false で retryAfter を返す", () => {
    checkRateLimit("user1", 2, 60 * 1000)
    checkRateLimit("user1", 2, 60 * 1000)

    const r = checkRateLimit("user1", 2, 60 * 1000)
    expect(r.allowed).toBe(false)
    expect(r.remaining).toBe(0)
    expect(r.retryAfter).toBeGreaterThan(0)
    expect(r.retryAfter).toBeLessThanOrEqual(60)
  })

  it("ウィンドウ期間が経過するとカウントがリセットされる", () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)

    // ウィンドウ1秒で制限を使い切る
    checkRateLimit("user1", 1, 1000)
    const r1 = checkRateLimit("user1", 1, 1000)
    expect(r1.allowed).toBe(false)

    // 2秒進めてウィンドウを超過させる
    vi.setSystemTime(2000)
    const r2 = checkRateLimit("user1", 1, 1000)
    expect(r2.allowed).toBe(true)
    expect(r2.remaining).toBe(0)

    vi.useRealTimers()
  })

  it("異なる識別子は独立してカウントされる", () => {
    checkRateLimit("user1", 1, 60 * 1000)
    checkRateLimit("user1", 1, 60 * 1000)

    const r1 = checkRateLimit("user1", 1, 60 * 1000)
    expect(r1.allowed).toBe(false)

    // user2 は別カウントなので allowed=true
    const r2 = checkRateLimit("user2", 1, 60 * 1000)
    expect(r2.allowed).toBe(true)
  })
})
