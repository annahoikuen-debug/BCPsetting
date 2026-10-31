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
// モック：Supabase Admin クライアント（ストレージ操作用）
// ---------------------------------------------------------------------------
const mockStorageUpload = vi.fn().mockResolvedValue({ error: null })
const mockStorageCreateSignedUrl = vi.fn().mockResolvedValue({
  data: { signedUrl: "https://signed.example.com/file.pdf" },
})
const mockStorageFrom = vi.fn(() => ({
  upload: mockStorageUpload,
  createSignedUrl: mockStorageCreateSignedUrl,
}))

const mockCreateAdminClient = vi.fn(() => ({
  storage: {
    from: mockStorageFrom,
  },
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

function setupCompanySelectMock() {
  mockCompaniesChain.single.mockResolvedValueOnce({
    data: {
      id: "c1",
      name: "テスト株式会社",
      document_version: 0,
      purchased_at: null,
    },
    error: null,
  })
}

function setupOrdersSelectMock(existing: boolean) {
  mockOrdersChain.single.mockResolvedValueOnce({
    data: existing ? { id: "o1", company_id: "c1" } : null,
    error: existing ? null : { code: "PGRST116" },
  })
}

function setupOrdersInsertMock() {
  mockOrdersChain.insert.mockResolvedValue({ error: null })
}

function setupBcpInputsSelectMock() {
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

function setupGeneratedDocumentsUpsertMock() {
  mockGeneratedDocumentsChain.upsert.mockResolvedValue({ error: null })
}

function setupCompaniesUpdateMock() {
  // バージョン確認用の companies.select().single() もモック化
  mockCompaniesChain.single.mockResolvedValueOnce({
    data: { document_version: 1 },
    error: null,
  })
}

function setupBcpInputsUpdateMock() {
  // 同様に makeChain で対応済み
}

// ---------------------------------------------------------------------------
// テスト前のリセット
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks()
  authMock()
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
      metadata: { company_id: "c1", user_id: "u1" },
      amount_total: amountTotal,
    } as never)

    setupProfileMock("c1")
    setupOrdersSelectMock(false) // 既存 orders なし
    setupCompanySelectMock()
    setupOrdersInsertMock()
    setupBcpInputsSelectMock()
    setupGeneratedDocumentsUpsertMock()
    setupCompaniesUpdateMock()
    setupBcpInputsUpdateMock()

    const result = await processPayment(sessionId)

    expect(result.success).toBe(true)

    // orders.insert の引数に amount: 9800 が含まれていること
    const insertCalls = mockOrdersChain.insert.mock.calls
    expect(insertCalls.length).toBe(1)
    const firstCall = insertCalls[0] as Record<string, unknown>[]
    expect(firstCall[0].amount).toBe(amountTotal)
    expect(firstCall[0].stripe_session_id).toBe(sessionId)
  })

  it("冪等性：既存 orders がある場合は insert が呼ばれず、amount の上書きは行われない", async () => {
    const processPayment = await importProcessPayment()

    mockRetrieve.mockResolvedValue({
      id: sessionId,
      payment_status: "paid",
      metadata: { company_id: "c1", user_id: "u1" },
      amount_total: amountTotal,
    } as never)

    setupProfileMock("c1")
    setupOrdersSelectMock(true) // 既存 orders あり

    const result = await processPayment(sessionId)

    expect(result.success).toBe(true)
    expect(result.idempotent).toBe(true)

    // orders.insert が呼ばれていないこと
    expect(mockOrdersChain.insert).not.toHaveBeenCalled()
  })
})
