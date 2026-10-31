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
const mockRetrieveSubscription = vi.fn()
const mockGetStripe = vi.fn(() => ({
  webhooks: { constructEvent: mockConstructEvent },
  subscriptions: { retrieve: mockRetrieveSubscription },
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
  mockRetrieveSubscription.mock.calls = []
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

  it("invoice.payment_succeeded（endive の parent 形状）で継続課金が記録される", async () => {
    const POST = await importHandler()

    // dedup チェック（未登録）→ 会社検索（ヒット）の順に single が呼ばれる
    mockSingle.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } })
    mockSingle.mockResolvedValueOnce({
      data: { id: "c1", subscription_status: "active", subscription_plan: "monthly" },
      error: null,
    })

    mockConstructEvent.mockResolvedValueOnce({
      id: "evt_invoice_1",
      type: "invoice.payment_succeeded",
      data: {
        object: {
          id: "in_1",
          customer: "cus_1",
          amount_total: 1480,
          // Stripe API endive (2026-09-30) 形状: トップレベル subscription は存在しない
          parent: {
            subscription_details: { subscription: "sub_1" },
          },
        },
      },
    } as never)

    const req = makeRequest({ body: '{"id":"evt_invoice_1"}' })
    const res = await POST(req as Request)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.received).toBe(true)

    // orders.insert に継続課金レコードが記録されること
    const orderInserts = mockInsert.mock.calls.filter(
      (call) => call[0] && call[0].plan_type === "subscription",
    )
    expect(orderInserts).toHaveLength(1)
    expect(orderInserts[0][0]).toMatchObject({
      company_id: "c1",
      stripe_session_id: "in_1",
      amount: 1480,
    })

    // companies.update で subscription_status が active に更新されること
    const companyUpdates = mockUpdate.mock.calls.filter(
      (call) => call[0] && call[0].subscription_status === "active",
    )
    expect(companyUpdates.length).toBeGreaterThanOrEqual(1)
  })

  it("サブスクの checkout.session.completed では Subscription を取得して実ステータスを保存する", async () => {
    const POST = await importHandler()

    mockRetrieveSubscription.mockResolvedValueOnce({
      id: "sub_1",
      status: "active",
      cancel_at_period_end: false,
      items: { data: [{ current_period_end: 1893456000 }] },
    } as never)

    mockConstructEvent.mockResolvedValueOnce({
      id: "evt_sub_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_sub_1",
          mode: "subscription",
          status: "complete", // セッション状態（保存してはいけない値）
          customer: "cus_1",
          subscription: "sub_1",
          metadata: { company_id: "c1", user_id: "u1", plan: "monthly" },
        },
      },
    } as never)

    const req = makeRequest({ body: '{"id":"evt_sub_1"}' })
    const res = await POST(req as Request)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.received).toBe(true)

    // Stripe からサブスクリプションが取得されていること
    expect(mockRetrieveSubscription).toHaveBeenCalledWith("sub_1")

    // companies.update に Subscription の実ステータスが保存されていること
    // （session.status の "complete" であってはならない）
    const companyUpdates = mockUpdate.mock.calls.filter(
      (call) => call[0] && call[0].subscription_status !== undefined,
    )
    expect(companyUpdates.length).toBeGreaterThanOrEqual(1)
    expect(companyUpdates[0][0]).toMatchObject({
      subscription_status: "active",
      stripe_subscription_id: "sub_1",
      subscription_plan: "monthly",
    })
  })

  it("customer.subscription.updated（endive 形状）で期間終了日が items から取得される", async () => {
    const POST = await importHandler()

    mockSingle.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } })
    mockSingle.mockResolvedValueOnce({ data: { id: "c1" }, error: null })

    mockConstructEvent.mockResolvedValueOnce({
      id: "evt_subupd_1",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_1",
          status: "past_due",
          cancel_at_period_end: true,
          // endive ではトップレベル current_period_end は削除済み
          items: { data: [{ current_period_end: 1893456000 }] },
        },
      },
    } as never)

    const req = makeRequest({ body: '{"id":"evt_subupd_1"}' })
    const res = await POST(req as Request)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.received).toBe(true)

    const companyUpdates = mockUpdate.mock.calls.filter(
      (call) => call[0] && call[0].subscription_status !== undefined,
    )
    expect(companyUpdates.length).toBeGreaterThanOrEqual(1)
    expect(companyUpdates[0][0]).toMatchObject({
      subscription_status: "past_due",
      subscription_cancel_at_period_end: true,
      subscription_current_period_end: new Date(1893456000 * 1000).toISOString(),
    })
  })
})
