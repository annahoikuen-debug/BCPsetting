import { describe, expect, it, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// モック：Stripe クライアント
// ---------------------------------------------------------------------------
const mockRetrieve = vi.fn()
const mockGetStripe = vi.fn(() => ({
  checkout: { sessions: { retrieve: mockRetrieve } },
}))

vi.mock("@/lib/stripe", () => ({
  getStripe: () => mockGetStripe(),
}))

// ---------------------------------------------------------------------------
// モック：Supabase Admin クライアント（ストレージ操作・RPC 用）
// ---------------------------------------------------------------------------
const mockStorageUpload = vi.fn().mockResolvedValue({ error: null })
const mockStorageCreateSignedUrl = vi.fn().mockResolvedValue({
  data: { signedUrl: "https://signed.example.com/file.pdf" },
})
const mockStorageFrom = vi.fn(() => ({
  upload: mockStorageUpload,
  createSignedUrl: mockStorageCreateSignedUrl,
}))
const mockRpc = vi.fn().mockResolvedValue({ data: 1, error: null })

const mockCreateAdminClient = vi.fn(() => ({
  storage: {
    from: mockStorageFrom,
  },
  rpc: mockRpc,
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}))

// ---------------------------------------------------------------------------
// モック：Supabase Server クライアント（テーブルごとに独立チェーン）
// ---------------------------------------------------------------------------
const mockAuth = { getUser: vi.fn() }

const makeChain = () => {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    insert: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.order.mockReturnValue(chain)
  chain.single.mockResolvedValue({ data: null, error: null })
  chain.maybeSingle.mockResolvedValue({ data: null, error: null })
  chain.insert.mockResolvedValue({ error: null })
  chain.upsert.mockResolvedValue({ error: null })
  chain.update.mockReturnValue(chain)
  return chain
}

const mockProfilesChain = makeChain()
const mockOrdersChain = makeChain()
const mockCompaniesChain = makeChain()
const mockBcpInputsChain = makeChain()
const mockGeneratedDocumentsChain = makeChain()

const mockFrom = vi.fn((table: string) => {
  switch (table) {
    case "profiles":
      return mockProfilesChain
    case "orders":
      return mockOrdersChain
    case "companies":
      return mockCompaniesChain
    case "bcp_inputs":
      return mockBcpInputsChain
    case "generated_documents":
      return mockGeneratedDocumentsChain
    default:
      return mockProfilesChain
  }
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
// モック：PDF 生成（renderToBuffer などを回避）
// ---------------------------------------------------------------------------
vi.mock("@/lib/pdf/generate-bcp", () => ({
  generateBcpPdf: vi.fn().mockResolvedValue(Buffer.from("fake-pdf-bcp")),
}))
vi.mock("@react-pdf/renderer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@react-pdf/renderer")>()
  return {
    ...actual,
    renderToBuffer: vi.fn().mockResolvedValue(Buffer.from("fake-pdf")),
  }
})

// ---------------------------------------------------------------------------
// テスト対象
// ---------------------------------------------------------------------------
async function importProcessPayment() {
  const mod = await import("@/app/checkout/success/page")
  return mod.processPayment
}

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------
function authMock() {
  mockAuth.getUser.mockResolvedValue({
    data: { user: { id: "u1", email: "user@example.com" } },
    error: null,
  })
}

function setupProfileMock(companyId: string) {
  mockProfilesChain.single.mockResolvedValueOnce({
    data: { company_id: companyId },
    error: null,
  })
}

function setupBcpInputsExistMock() {
  // processPayment の事前存在確認（maybeSingle）
  mockBcpInputsChain.maybeSingle.mockResolvedValueOnce({
    data: { company_id: "c1" },
    error: null,
  })
}

function setupBcpInputsSelectMock() {
  // generateAndStoreDocuments 内のドラフト取得（single）
  mockBcpInputsChain.single.mockResolvedValueOnce({
    data: {
      company_id: "c1",
      policy: [],
      risk_assessment: [],
      core_business: [],
      emergency_contacts: {},
      measures_and_finance: {},
    },
    error: null,
  })
}

function setupCompanySelectMock() {
  mockCompaniesChain.single.mockResolvedValueOnce({
    data: {
      id: "c1",
      name: "テスト株式会社",
      representative: null,
      industry: "オフィス",
      address: "東京都",
      employee_scale: "10-49名",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: null,
      purchased_at: null,
      document_version: 0,
      is_completed: false,
    },
    error: null,
  })
}

function setupOrdersSelectMock(existing: boolean) {
  mockOrdersChain.maybeSingle.mockResolvedValueOnce({
    data: existing ? { id: "o1", company_id: "c1" } : null,
    error: existing ? null : { code: "PGRST116" },
  })
}

function setupOrdersInsertMock() {
  mockOrdersChain.insert.mockResolvedValue({ error: null })
}

function setupGeneratedDocumentsUpsertMock() {
  mockGeneratedDocumentsChain.upsert.mockResolvedValue({ error: null })
}

// ---------------------------------------------------------------------------
// テスト前のリセット
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks()
  authMock()
  mockStorageUpload.mockResolvedValue({ error: null })
  mockStorageCreateSignedUrl.mockResolvedValue({
    data: { signedUrl: "https://signed.example.com/file.pdf" },
  })
  mockRpc.mockResolvedValue({ data: 1, error: null })
})

describe("processPayment (orders.amount recorded from Stripe)", () => {
  const sessionId = "cs_test_123"
  const amountTotal = 9800

  it("orders.insert の amount に Stripe セッションの amount_total が記録される", async () => {
    const processPayment = await importProcessPayment()

    // Stripe セッション：支払い完了、amount_total=9800
    mockRetrieve.mockResolvedValue({
      id: sessionId,
      payment_status: "paid",
      mode: "payment",
      metadata: { company_id: "c1", user_id: "u1" },
      amount_total: amountTotal,
    } as never)

    setupProfileMock("c1")
    setupBcpInputsExistMock()
    setupOrdersSelectMock(false) // 既存 orders なし
    setupOrdersInsertMock()
    setupCompanySelectMock()
    setupBcpInputsSelectMock()
    setupGeneratedDocumentsUpsertMock()

    const result = await processPayment(sessionId)

    expect(result.success).toBe(true)

    // orders.insert の引数に amount: 9800 が含まれていること
    const insertCalls = mockOrdersChain.insert.mock.calls
    expect(insertCalls.length).toBe(1)
    const firstCall = insertCalls[0] as Record<string, unknown>[]
    expect(firstCall[0].amount).toBe(amountTotal)
    expect(firstCall[0].stripe_session_id).toBe(sessionId)
  })

  it("BCP ドラフトが存在しない場合は orders を作成せずエラーを返す（支払済み不整合の防止）", async () => {
    const processPayment = await importProcessPayment()

    mockRetrieve.mockResolvedValue({
      id: sessionId,
      payment_status: "paid",
      mode: "payment",
      metadata: { company_id: "c1", user_id: "u1" },
      amount_total: amountTotal,
    } as never)

    setupProfileMock("c1")
    // ドラフト不在
    mockBcpInputsChain.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { code: "PGRST116" },
    })

    const result = await processPayment(sessionId)

    expect(result.success).toBe(false)
    expect(result.error).toContain("BCP 策定データ")
    // 注文レコードは作成されないこと
    expect(mockOrdersChain.insert).not.toHaveBeenCalled()
  })

  it("冪等性：既存 orders かつ文書がある場合は insert されず冪等成功を返す", async () => {
    const processPayment = await importProcessPayment()

    mockRetrieve.mockResolvedValue({
      id: sessionId,
      payment_status: "paid",
      mode: "payment",
      metadata: { company_id: "c1", user_id: "u1" },
      amount_total: amountTotal,
    } as never)

    setupProfileMock("c1")
    setupBcpInputsExistMock()
    setupOrdersSelectMock(true) // 既存 orders あり
    // 既存文書あり（select().eq().order().order() のため、1回目はチェーン、
    // 2回目が最終値を返す）
    mockGeneratedDocumentsChain.order
      .mockReturnValueOnce(mockGeneratedDocumentsChain)
      .mockResolvedValueOnce({
        data: [
          { doc_type: "bcp_full", file_url: "c1/bcp_full_v1.pdf", version: 1 },
        ],
        error: null,
      })
    mockCompaniesChain.single.mockResolvedValueOnce({
      data: { name: "テスト株式会社" },
      error: null,
    })

    const result = await processPayment(sessionId)

    expect(result.success).toBe(true)
    expect(result.idempotent).toBe(true)

    // orders.insert が呼ばれていないこと
    expect(mockOrdersChain.insert).not.toHaveBeenCalled()
  })

  it("既存 orders はあるが文書が無い場合（過去の生成失敗）は注文を重複作成せず生成を再試行する", async () => {
    const processPayment = await importProcessPayment()

    mockRetrieve.mockResolvedValue({
      id: sessionId,
      payment_status: "paid",
      mode: "payment",
      metadata: { company_id: "c1", user_id: "u1" },
      amount_total: amountTotal,
    } as never)

    setupProfileMock("c1")
    setupBcpInputsExistMock()
    setupOrdersSelectMock(true) // 既存 orders あり
    // 既存文書なし（過去の生成失敗）: 1回目はチェーン、2回目が最終値
    mockGeneratedDocumentsChain.order
      .mockReturnValueOnce(mockGeneratedDocumentsChain)
      .mockResolvedValueOnce({ data: [], error: null })
    setupCompanySelectMock()
    setupBcpInputsSelectMock()
    setupGeneratedDocumentsUpsertMock()

    const result = await processPayment(sessionId)

    expect(result.success).toBe(true)
    // 注文は重複作成されないこと
    expect(mockOrdersChain.insert).not.toHaveBeenCalled()
    // 生成処理（バージョン採番 RPC・文書登録）が実行されていること
    expect(mockRpc).toHaveBeenCalled()
    expect(mockGeneratedDocumentsChain.upsert).toHaveBeenCalled()
  })

  it("バージョン採番は service_role の RPC で原子的に行われる", async () => {
    const processPayment = await importProcessPayment()

    mockRetrieve.mockResolvedValue({
      id: sessionId,
      payment_status: "paid",
      mode: "payment",
      metadata: { company_id: "c1", user_id: "u1" },
      amount_total: amountTotal,
    } as never)

    setupProfileMock("c1")
    setupBcpInputsExistMock()
    setupOrdersSelectMock(false)
    setupOrdersInsertMock()
    setupCompanySelectMock()
    setupBcpInputsSelectMock()
    setupGeneratedDocumentsUpsertMock()

    const result = await processPayment(sessionId)

    expect(result.success).toBe(true)
    // RPC が company_id を引数に呼ばれていること
    expect(mockRpc).toHaveBeenCalledWith("increment_document_version", {
      p_company_id: "c1",
    })
    // 文書は採番されたバージョンで登録されていること
    const upsertCalls = mockGeneratedDocumentsChain.upsert.mock
      .calls as unknown as Array<Array<Record<string, unknown>[]>>
    expect(upsertCalls[0][0][0].version).toBe(1)
  })
})
