import { describe, expect, it, vi, beforeEach } from "vitest"
import type { BcpWizardInput } from "@/types/bcp"

// ---------------------------------------------------------------------------
// モック：Supabase Server クライアント
// ---------------------------------------------------------------------------
const mockAuth = { getUser: vi.fn() }
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()
const mockMaybeSingle = vi.fn()
const mockUpsert = vi.fn()
const mockUpdate = vi.fn()

const mockFrom = vi.fn(() => {
  const chain = {
    select: mockSelect,
    eq: mockEq,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    upsert: mockUpsert,
    update: mockUpdate,
  }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.single.mockResolvedValue({ data: null, error: null })
  chain.maybeSingle.mockResolvedValue({ data: null, error: null })
  chain.upsert.mockResolvedValue({ error: null })
  chain.update.mockReturnValue(chain)
  return chain
})

const mockSupabase = {
  auth: mockAuth,
  from: mockFrom,
}

const mockCreateClient = vi.fn(() => mockSupabase)

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}))

// ---------------------------------------------------------------------------
// テスト対象
// ---------------------------------------------------------------------------
async function importUpsertBcpDraft() {
  const mod = await import("@/app/actions/bcp")
  return mod.upsertBcpDraft
}

// ---------------------------------------------------------------------------
// ヘルパー：テーブルごとのモック戻り値を設定
// ---------------------------------------------------------------------------
function setupProfileMock(companyId: string) {
  mockSelect.mockReturnValue({ eq: mockEq, single: mockSingle })
  mockEq.mockReturnValue({ single: mockSingle })
  // profiles: company_id を返す
  mockSingle.mockResolvedValueOnce({ data: { company_id: companyId }, error: null })
}

/**
 * 編集ロック判定用の companies 取得（maybeSingle）をモックする。
 * upsertBcpDraft は profiles の次にこのクエリを発行するため、
 * bcp_inputs の step_status 取得より先に 1 スロット消費する。
 */
function setupEditLockMock(
  company: { purchased_at: string | null; subscription_status: string | null } | null,
) {
  mockMaybeSingle.mockResolvedValueOnce({ data: company, error: null })
}

function setupCompanyUpsertMock() {
  mockUpsert.mockResolvedValue({ error: null })
}

function setupBcpInputsSelectMock(stepStatus: number | null) {
  // bcp_inputs select: 既存の step_status を返す（maybeSingle）
  mockSelect.mockReturnValue({ eq: mockEq, maybeSingle: mockMaybeSingle })
  mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle })
  mockMaybeSingle.mockResolvedValueOnce({ data: { step_status: stepStatus }, error: null })
}

function setupBcpInputsUpsertMock() {
  mockUpsert.mockResolvedValue({ error: null })
}

function setupCompanyUpdateMock() {
  mockUpdate.mockReturnValue({ eq: mockEq })
  mockEq.mockResolvedValue({ error: null })
}

function authMock() {
  mockAuth.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null })
}

// ---------------------------------------------------------------------------
// テスト前のリセット
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks()
  authMock()
  setupProfileMock("c1")
})

describe("upsertBcpDraft (step_status 退行防止)", () => {
  const validStep1 = {
    companyName: "テスト株式会社",
    address: "東京都千代田区",
    industry: "オフィス",
    employeeScale: "10-49名",
  }

  it("既存 step_status が 3 で step2 以降が検証通過の場合、step_status は最大値（4）に更新される（退行防止）", async () => {
    const upsertBcpDraft = await importUpsertBcpDraft()

    setupEditLockMock({ purchased_at: null, subscription_status: null })
    setupCompanyUpsertMock()
    setupBcpInputsSelectMock(3)
    setupBcpInputsUpsertMock()

    const data = {
      step1: validStep1,
      step2: [{ type: "安全確保", priority: "高", text: "方針" }],
      step3: [],
      step4: [],
      step5: { responseHead: "", deputy: "", safetyCheckPerson: "", keyPartners: [] },
      step6: { backupMethod: "", stockpileItems: [], fundingPlan: "未定", hasInsurance: false },
    }

    const result = await upsertBcpDraft(data as unknown as BcpWizardInput, "c1")

    expect(result.success).toBe(true)

    // bcp_inputs upsert に step_status: 4 が含まれていること（退行防止：既存3 と今回4 の最大値）
    const upsertCalls = mockUpsert.mock.calls
    const bcpUpsertCall = upsertCalls.find(
      (call) => call[0] && typeof call[0] === "object" && "step_status" in call[0],
    )
    expect(bcpUpsertCall).toBeDefined()
    const firstArg = bcpUpsertCall?.[0] as Record<string, unknown>
    expect(firstArg.step_status).toBe(4)
  })

  it("既存 step_status が 1 で step4 のみ検証通過の場合、step_status は 4 に更新される", async () => {
    const upsertBcpDraft = await importUpsertBcpDraft()

    setupEditLockMock({ purchased_at: null, subscription_status: null })
    setupCompanyUpsertMock()
    setupBcpInputsSelectMock(1)
    setupBcpInputsUpsertMock()

    const data = {
      step1: validStep1,
      step2: [],
      step3: [],
      step4: [{ name: "受発注業務", bottleneckEquipment: ["POSレジ"] }],
      step5: { responseHead: "", deputy: "", safetyCheckPerson: "", keyPartners: [] },
      step6: { backupMethod: "", stockpileItems: [], fundingPlan: "未定", hasInsurance: false },
    }

    const result = await upsertBcpDraft(data as unknown as BcpWizardInput, "c1")

    expect(result.success).toBe(true)

    const upsertCalls = mockUpsert.mock.calls
    const bcpUpsertCall = upsertCalls.find(
      (call) => call[0] && typeof call[0] === "object" && "step_status" in call[0],
    )
    expect(bcpUpsertCall).toBeDefined()
    const firstArg = bcpUpsertCall?.[0] as Record<string, unknown>
    expect(firstArg.step_status).toBe(4)
  })

  it("step1 以外のみ更新された場合、companies.updated_at がタッチされる", async () => {
    const upsertBcpDraft = await importUpsertBcpDraft()

    // step1 は空（未入力）なので companies upsert は呼ばれない
    setupEditLockMock({ purchased_at: null, subscription_status: null })
    setupBcpInputsSelectMock(0)
    setupBcpInputsUpsertMock()
    setupCompanyUpdateMock()

    const data = {
      step1: { companyName: "", address: "", industry: "オフィス", employeeScale: "10-49名" },
      step2: [{ type: "安全確保", priority: "高", text: "方針" }],
      step3: [],
      step4: [],
      step5: { responseHead: "", deputy: "", safetyCheckPerson: "", keyPartners: [] },
      step6: { backupMethod: "", stockpileItems: [], fundingPlan: "未定", hasInsurance: false },
    }

    const result = await upsertBcpDraft(data as unknown as BcpWizardInput, "c1")

    expect(result.success).toBe(true)

    // companies.update が呼ばれ、eq("id", "c1") で絞り込まれていること
    expect(mockUpdate).toHaveBeenCalled()
    expect(mockEq).toHaveBeenCalledWith("id", "c1")
  })

  it("購入後7日を過ぎた都度購入者は編集を拒否され、保存は行われない（H1: サーバー側強制）", async () => {
    const upsertBcpDraft = await importUpsertBcpDraft()

    // 8日前に購入（サブスクなし）
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
    setupEditLockMock({ purchased_at: eightDaysAgo, subscription_status: null })

    const data = {
      step1: validStep1,
      step2: [{ type: "安全確保", priority: "高", text: "方針" }],
      step3: [],
      step4: [],
      step5: { responseHead: "", deputy: "", safetyCheckPerson: "", keyPartners: [] },
      step6: { backupMethod: "", stockpileItems: [], fundingPlan: "未定", hasInsurance: false },
    }

    const result = await upsertBcpDraft(data as unknown as BcpWizardInput, "c1")

    expect(result.success).toBe(false)
    expect(result.error).toContain("7日間")
    // 保存処理（companies upsert / bcp_inputs upsert）が行われないこと
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it("購入後7日を過ぎていてもサブスク契約中なら編集できる", async () => {
    const upsertBcpDraft = await importUpsertBcpDraft()

    // 30日前に購入したが、サブスク契約中
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    setupEditLockMock({ purchased_at: thirtyDaysAgo, subscription_status: "active" })
    setupBcpInputsSelectMock(0)
    setupBcpInputsUpsertMock()

    const data = {
      step1: validStep1,
      step2: [{ type: "安全確保", priority: "高", text: "方針" }],
      step3: [],
      step4: [],
      step5: { responseHead: "", deputy: "", safetyCheckPerson: "", keyPartners: [] },
      step6: { backupMethod: "", stockpileItems: [], fundingPlan: "未定", hasInsurance: false },
    }

    const result = await upsertBcpDraft(data as unknown as BcpWizardInput, "c1")

    expect(result.success).toBe(true)
  })
})
