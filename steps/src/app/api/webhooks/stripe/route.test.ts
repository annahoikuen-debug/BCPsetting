import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"

// ---------------------------------------------------------------------------
// モック：next/headers（Route Handler で使用）
// ---------------------------------------------------------------------------
const mockHeaders = vi.fn(() => new Headers({ "stripe-signature": "" }))
vi.mock("next/headers", () => ({
  headers: mockHeaders,
}))

// ---------------------------------------------------------------------------
// モック：Stripe クライアント
// ---------------------------------------------------------------------------
const mockConstructEvent = vi.fn()
const mockGetStripe = vi.fn(() => ({
  webhooks: { constructEvent: mockConstructEvent },
}))

vi.mock("@/lib/stripe", () => ({
  getStripe: () => mockGetStripe(),
}))

// ---------------------------------------------------------------------------
// モック：Supabase Admin クライアント
// ---------------------------------------------------------------------------
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()
const mockInsert = vi.fn()
const mockUpsert = vi.fn()
const mockUpdate = vi.fn()
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  upsert: vi.fn(),
  update: vi.fn(),
}))

const mockCreateAdminClient = vi.fn(() => ({
  from: mockFrom,
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}))

// ---------------------------------------------------------------------------
// テスト対象の Route Handler を動的インポート
// ---------------------------------------------------------------------------
async function importHandler() {
  const mod = await import("./route")
  return mod.POST
}

// ---------------------------------------------------------------------------
// ヘルパー：模擬 Request オブジェクトを作成
// ---------------------------------------------------------------------------
function makeRequest({
  body,
  signature = "t=123,v1=fakesignature",
}: {
  body: string
  signature?: string
}): Request {
  // next/headers のモックに現在のシグネチャを設定
  mockHeaders.mockImplementation(() => new Headers({ "stripe-signature": signature }))
  return new Request("https://example.com/api/webhooks/stripe", {
    method: "POST",
    body,
    headers: {
      "stripe-signature": signature,
      "content-type": "application/json",
    },
  })
}

// ---------------------------------------------------------------------------
// テスト前後のモック状態リセット
// ---------------------------------------------------------------------------
beforeEach(() => {
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test"

  // 呼び出し履歴のみクリア（実装は保持）
  mockSelect.mock.calls = []
  mockEq.mock.calls = []
  mockSingle.mock.calls = []
  mockInsert.mock.calls = []
  mockUpsert.mock.calls = []
  mockUpdate.mock.calls = []
  mockConstructEvent.mock.calls = []
  mockFrom.mock.calls = []
  mockCreateAdminClient.mock.calls = []

  // Supabase Admin クライアントモックの実装を再設定
  mockCreateAdminClient.mockReturnValue({ from: mockFrom })
  mockFrom.mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
    upsert: mockUpsert,
    update: mockUpdate,
  })
  mockSelect.mockReturnValue({ eq: mockEq, single: mockSingle })
  mockEq.mockReturnValue({ single: mockSingle })
  mockSingle.mockResolvedValue({ data: null, error: { code: "PGRST116" } })
  mockInsert.mockResolvedValue({ error: null })
  mockUpsert.mockResolvedValue({ error: null })
  mockUpdate.mockReturnValue({ eq: mockEq })

  // Stripe モック
  mockConstructEvent.mockResolvedValue({
    id: "evt_test_unique",
    type: "checkout.session.completed",
    data: { object: { id: "cs_test_123", metadata: { company_id: "c1", user_id: "u1" } } },
  } as never)
})

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.STRIPE_WEBHOOK_SECRET
})

describe("POST /api/webhooks/stripe", () => {
  it("正常な Webhook イベントは 200 を返し、処理済みイベントを記録する", async () => {
    const POST = await importHandler()
    const req = makeRequest({ body: '{"id":"evt_test_unique"}' })

    const res = await POST(req as Request)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.received).toBe(true)
    expect(mockConstructEvent).toHaveBeenCalledTimes(1)
    // 処理済みイベントが insert される
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ event_id: "evt_test_unique", event_type: "checkout.session.completed" }),
    )
  })

  it("同一 event.id の重複リクエストは duplicate=true で 200 を返す（リプレイ対策）", async () => {
    const POST = await importHandler()

    // 1回目：未登録 → 正常処理
    const req1 = makeRequest({ body: '{"id":"evt_duplicate"}' })
    mockConstructEvent.mockResolvedValueOnce({
      id: "evt_duplicate",
      type: "checkout.session.completed",
      data: { object: { id: "cs_test_1", metadata: { company_id: "c1", user_id: "u1" } } },
    } as never)
    const res1 = await POST(req1 as Request)
    expect(res1.status).toBe(200)

    // 2回目：同一 event.id → 重複として即座に 200（duplicate=true）
    mockSingle.mockResolvedValueOnce({ data: { id: "wh_1" }, error: null })
    const req2 = makeRequest({ body: '{"id":"evt_duplicate"}' })
    mockConstructEvent.mockResolvedValueOnce({
      id: "evt_duplicate",
      type: "checkout.session.completed",
      data: { object: { id: "cs_test_1", metadata: { company_id: "c1", user_id: "u1" } } },
    } as never)
    const res2 = await POST(req2 as Request)
    const json2 = await res2.json()

    expect(res2.status).toBe(200)
    expect(json2.duplicate).toBe(true)
    // 2回目のリクエストでは重複ガードにより早期リターンするため、
    // stripe_webhook_events への追加 insert は行われない。
    // 1回目のリクエストで orders.insert と stripe_webhook_events.insert の
    // 計2回呼ばれるのが正常。
    const insertCalls = mockInsert.mock.calls
    const webhookEventInserts = insertCalls.filter(
      (call) => call[0] && call[0].event_id === "evt_duplicate",
    )
    expect(webhookEventInserts).toHaveLength(1)
  })

  it("Webhook 署名検証に失敗した場合は 400 を返す", async () => {
    const POST = await importHandler()
    mockConstructEvent.mockRejectedValueOnce(new Error("Invalid signature"))

    const req = makeRequest({ body: '{"id":"evt_bad"}' })
    const res = await POST(req as Request)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain("署名検証に失敗しました")
  })
})
