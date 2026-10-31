import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"

// ---------------------------------------------------------------------------
// モック：Supabase Server クライアント（認証チェック通過用）
// ---------------------------------------------------------------------------
const mockAuth = { getUser: vi.fn() }
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()

const mockFrom = vi.fn(() => {
  const chain = {
    select: mockSelect,
    eq: mockEq,
    single: mockSingle,
  }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.single.mockResolvedValue({ data: { company_id: "c1" }, error: null })
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
// モック：Stripe クライアント（CSRF テストでは Stripe への実際の呼び出しを回避）
// ---------------------------------------------------------------------------
const mockStripeSessionsCreate = vi.fn().mockResolvedValue({
  id: "cs_test_1",
  url: "https://checkout.stripe.com/session/cs_test_1",
})

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    checkout: { sessions: { create: mockStripeSessionsCreate } },
  }),
}))

// ---------------------------------------------------------------------------
// テスト対象
// ---------------------------------------------------------------------------
async function importCheckoutRoute() {
  const mod = await import("@/app/api/checkout/route")
  return mod.POST
}

async function importSubscribeCheckoutRoute() {
  const mod = await import("@/app/api/subscribe/checkout/route")
  return mod.POST
}

async function importSubscribePortalRoute() {
  const mod = await import("@/app/api/subscribe/portal/route")
  return mod.POST
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

function makeRequest(url: string, origin: string, body?: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

// ---------------------------------------------------------------------------
// テスト前のリセット
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks()
  authMock()
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000"
})

afterEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL
})

describe("CSRF / same-origin check (S8)", () => {
  const evilOrigin = "https://evil.example.com"

  it("/api/checkout: 異なるオリジンは 403 を返す", async () => {
    const POST = await importCheckoutRoute()
    const req = makeRequest("http://localhost:3000/api/checkout", evilOrigin)

    const res = await POST(req as Request)
    expect(res.status).toBe(403)
  })

  it("/api/checkout: 同じオリジンは 403 にならない（認証チェック等に進む）", async () => {
    const POST = await importCheckoutRoute()
    const req = makeRequest("http://localhost:3000/api/checkout", "http://localhost:3000")

    const res = await POST(req as Request)
    // 認証済み・プロファイルありなので、Stripe セッション作成に進むか、
    // 少なくとも 403 にはならない
    expect(res.status).not.toBe(403)
  })

  it("/api/subscribe/checkout: 異なるオリジンは 403 を返す", async () => {
    const POST = await importSubscribeCheckoutRoute()
    const req = makeRequest(
      "http://localhost:3000/api/subscribe/checkout",
      evilOrigin,
      { plan: "monthly" },
    )

    const res = await POST(req as Request)
    expect(res.status).toBe(403)
  })

  it("/api/subscribe/checkout: 同じオリジンは 403 にならない", async () => {
    const POST = await importSubscribeCheckoutRoute()
    const req = makeRequest(
      "http://localhost:3000/api/subscribe/checkout",
      "http://localhost:3000",
      { plan: "monthly" },
    )

    const res = await POST(req as Request)
    expect(res.status).not.toBe(403)
  })

  it("/api/subscribe/portal: 異なるオリジンは 403 を返す", async () => {
    const POST = await importSubscribePortalRoute()
    const req = makeRequest("http://localhost:3000/api/subscribe/portal", evilOrigin)

    const res = await POST(req as Request)
    expect(res.status).toBe(403)
  })

  it("/api/subscribe/portal: 同じオリジンは 403 にならない", async () => {
    const POST = await importSubscribePortalRoute()
    const req = makeRequest("http://localhost:3000/api/subscribe/portal", "http://localhost:3000")

    const res = await POST(req as Request)
    expect(res.status).not.toBe(403)
  })
})
