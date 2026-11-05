import { describe, expect, it, vi, beforeEach } from "vitest"

/**
 * E2E 検証で発見・修正したバグの回帰テスト。
 *
 * WHY: NEXT_PUBLIC_* はビルド時の静的置換（process.env.NEXT_PUBLIC_X の直書きのみ）で
 * クライアントバンドルへインライン化される。かつて process.env[name] の動的アクセスを
 * 使っていたため、ブラウザ側では常に undefined となり、クライアントの全 Supabase 通信
 * （サマリーのドラフト取得・profiles 参照等）が握りつぶされたエラーで失敗していた。
 */

const mockCreateBrowserClient = vi.fn()
mockCreateBrowserClient.mockImplementation(() => ({
  auth: {},
  from: vi.fn(),
}))

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: (...args: unknown[]) => mockCreateBrowserClient(...args),
}))
describe("lib/supabase/client（ブラウザ用 Supabase クライアント）", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  })

  it("NEXT_PUBLIC_* が設定されていれば、その値でブラウザクライアントを生成する", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key"

    const { createClient } = await import("@/lib/supabase/client")

    createClient()

    expect(mockCreateBrowserClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "test-anon-key",
    )
  })

  it("環境変数が未設定の場合は、どちらの変数が欠けているかを明示したエラーを投げる", async () => {
    const { createClient } = await import("@/lib/supabase/client")

    expect(() => createClient()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/)
  })

  it("動的アクセス process.env[...] が再導入されていないこと", async () => {
    // Turbopack / Next.js の環境変数インライン化は静的なプロパティアクセスのみが対象。
    // 動的アクセスが戻ってきたらクライアント側で env が常に undefined になる。
    const fs = await import("node:fs")
    const path = await import("node:path")
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/supabase/client.ts"),
      "utf8",
    )

    expect(source).not.toMatch(/process\.env\s*\[/)
  })
})
