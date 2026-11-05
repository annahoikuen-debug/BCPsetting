import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * E2E 検証で発見・修正したバグの回帰テスト。
 *
 * WHY: wizard/page.tsx の debouncedAutosave は useCallback([], ...) で
 * 初回レンダーのクロージャを固定する。かつてそのクロージャ内から state の
 * companyId を直接参照していたため、常に初回値（null）を見て自動保存が
 * 恒久的に no-op になるバグが存在した（ensureProfile 完了後も保存されない）。
 *
 * 対策として companyId を useRef（companyIdRef）でミラーし、
 * performAutosave / handleSubmitAll は ref 経由で最新値を参照する。
 *
 * 本テストはソースのパターン検査によりこの修正が維持されていることを検証する。
 * リファクタで構造が変わった場合は、同等の性質（最新の companyId を保存経路が
 * 参照すること）を検査するよう本テストも更新すること。
 */

const SOURCE = readFileSync(
  join(process.cwd(), "src/app/wizard/page.tsx"),
  "utf8",
)

describe("ウィザード自動保存の stale closure 回帰防止", () => {
  it("companyId は ref（companyIdRef）でミラーされている", () => {
    expect(SOURCE).toMatch(/const companyIdRef = useRef<string \| null>\(null\)/)
  })

  it("hydrate（ensureProfile 完了後）に companyIdRef.current を更新している", () => {
    expect(SOURCE).toMatch(/companyIdRef\.current = cid/)
  })

  it("performAutosave / handleSubmitAll が companyIdRef.current を参照している", () => {
    // performAutosave と handleSubmitAll の 2 箇所が必要
    const refs = SOURCE.match(/const cid = companyIdRef\.current/g) ?? []
    expect(refs.length).toBeGreaterThanOrEqual(2)
  })

  it("upsertBcpDraft へは ref 由来の cid が渡される", () => {
    expect(SOURCE).toContain("upsertBcpDraft(allData as any, cid)")
  })
})
