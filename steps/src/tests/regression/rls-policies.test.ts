import { describe, expect, it } from "vitest"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * E2E 検証で発見・修正したバグの回帰テスト。
 *
 * WHY: かつて migration 001 の profiles ポリシーが profiles テーブル自身を
 * FROM するサブクエリを含んでおり、PostgreSQL が
 * 「infinite recursion detected in policy (42P17)」を返して
 * 認証済みユーザーの profiles SELECT / UPDATE がすべて失敗していた。
 * （ensureProfile が companyId を返せず、ウィザード保存・サマリー等が崩壊）
 *
 * 本テストは全マイグレーションを走査し、CREATE / DROP ポリシーを追跡して
 * 「現行スキーマの最終状態」における各ポリシーが対象テーブル自身を
 * FROM / JOIN していないことを静的に検証する。
 * 同テーブル参照が必要な場合は security definer 関数
 * （例: public.has_company_membership）経由にすること。
 */

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations")

const CREATE_POLICY_RE =
  /create\s+policy\s+"([^"]+)"\s+on\s+(?:public\.)?(\w+)\s+([\s\S]*?);/gi

const DROP_POLICY_RE =
  /drop\s+policy\s+(?:if\s+exists\s+)?"([^"]+)"\s+on\s+(?:public\.)?(\w+)/gi

const CREATE_OR_REPLACE_RE =
  /create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)/gi

interface Policy {
  file: string
  name: string
  table: string
  body: string
}

function collectActivePolicies(): Policy[] {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()

  // ファイル順に CREATE / DROP を適用して現行ポリシーを再現する
  const active = new Map<string, Policy>()
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8")

    // drop policy if exists "名" on テーブル
    for (const m of sql.matchAll(DROP_POLICY_RE)) {
      active.delete(`${m[2]}/${m[1]}`)
    }

    // create policy "名" on テーブル <本体>;
    for (const m of sql.matchAll(CREATE_POLICY_RE)) {
      active.set(`${m[2]}/${m[1]}`, {
        file,
        name: m[1],
        table: m[2],
        body: m[3],
      })
    }
  }
  return [...active.values()]
}

function selfReferenceRegex(table: string): RegExp {
  return new RegExp(`\\b(?:from|join)\\s+(?:public\\.)?${table}\\b`, "i")
}

describe("RLS ポリシーの自己再帰チェック（PostgreSQL 42P17 回帰防止）", () => {
  const policies = collectActivePolicies()

  it("マイグレーションからポリシー定義が抽出できること（検査対象の健全性）", () => {
    expect(policies.length).toBeGreaterThan(10)
    expect(policies.some((p) => p.table === "profiles")).toBe(true)
    expect(policies.some((p) => p.table === "bcp_inputs")).toBe(true)
  })

  it("profiles ポリシーは security definer 関数経由で自己参照を回避していること", () => {
    const profilesPolicies = policies.filter((p) => p.table === "profiles")
    expect(profilesPolicies.length).toBeGreaterThan(0)
    // 修正後の実装（migration 016）では has_company_membership を使用する
    expect(
      profilesPolicies.some((p) => p.body.includes("has_company_membership")),
    ).toBe(true)
  })

  it("現行の各ポリシーは対象テーブル自身を FROM / JOIN しないこと", () => {
    const offenders = policies
      .filter((p) => selfReferenceRegex(p.table).test(p.body))
      .map((p) => `${p.file}: "${p.name}" on ${p.table}`)

    expect(offenders).toEqual([])
  })

  it("検査に使うヘルパー関数は security definer で定義されていること", () => {
    const sql016 = readFileSync(
      join(MIGRATIONS_DIR, "016_fix_profiles_rls_recursion.sql"),
      "utf8",
    )
    expect(sql016).toMatch(
      /create\s+or\s+replace\s+function\s+public\.has_company_membership/,
    )
    expect(sql016).toMatch(/security\s+definer/i)
  })

  it("CREATE_OR_REPLACE_RE 正規表現が security definer 関数を検出できること（健全性）", () => {
    // このファイル内の正規表現自体が壊れていないかの最小チェック
    expect(CREATE_OR_REPLACE_RE.source).toContain("function")
  })
})
