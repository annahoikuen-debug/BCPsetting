import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"

// ---------------------------------------------------------------------------
// モック：archiver（動的インポートされる ZIP ライブラリ）
// ---------------------------------------------------------------------------
const mockArchiveOn = vi.fn()
const mockArchiveAppend = vi.fn()
const mockArchiveFinalize = vi.fn()

vi.mock("archiver", () => ({
  default: vi.fn(() => ({
    on: mockArchiveOn,
    append: mockArchiveAppend,
    finalize: mockArchiveFinalize,
  })),
}))

// ---------------------------------------------------------------------------
// モック：Supabase Server クライアント（認証チェック用）
// ---------------------------------------------------------------------------
const mockAuth = { getUser: vi.fn() }

const makeChain = () => {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    single: vi.fn(),
  }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.order.mockReturnValue(chain)
  chain.single.mockResolvedValue({ data: null, error: null })
  return chain
}

const mockProfilesChain = makeChain()
const mockDocumentsChain = makeChain()

const mockFrom = vi.fn((table: string) => {
  if (table === "profiles") return mockProfilesChain
  if (table === "generated_documents") return mockDocumentsChain
  return mockProfilesChain
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
// モック：Supabase Admin クライアント（ストレージダウンロード用）
// ---------------------------------------------------------------------------
const mockStorageDownload = vi.fn()
const mockStorageFrom = vi.fn(() => ({
  download: mockStorageDownload,
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
// テスト対象
// ---------------------------------------------------------------------------
async function importZipRoute() {
  const mod = await import("@/app/api/download/zip/route")
  return mod.GET
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
  mockProfilesChain.select.mockReturnValue(mockProfilesChain)
  mockProfilesChain.eq.mockReturnValue(mockProfilesChain)
  mockProfilesChain.single.mockResolvedValue({
    data: { company_id: companyId },
    error: null,
  })
}

function setupDocumentsMock(docs: Array<{ docType: string; fileUrl: string; version: number }>) {
  mockDocumentsChain.select.mockReturnValue(mockDocumentsChain)
  mockDocumentsChain.eq.mockReturnValue(mockDocumentsChain)
  mockDocumentsChain.order.mockResolvedValue({ data: docs, error: null })
  console.log("setupDocumentsMock called, docs length:", docs.length)
}

function setupStorageDownloadAllFail() {
  mockStorageDownload.mockResolvedValue({ data: null, error: { message: "Not found" } })
}

// ---------------------------------------------------------------------------
// テスト前のリセット
// ---------------------------------------------------------------------------
beforeEach(() => {
  // 呼び出し履歴のみクリア（実装は保持）
  mockProfilesChain.select.mock.calls = []
  mockProfilesChain.eq.mock.calls = []
  mockProfilesChain.single.mock.calls = []
  mockDocumentsChain.select.mock.calls = []
  mockDocumentsChain.eq.mock.calls = []
  mockDocumentsChain.order.mock.calls = []
  mockDocumentsChain.single.mock.calls = []
  mockAuth.getUser.mock.calls = []
  mockStorageDownload.mock.calls = []
  mockStorageFrom.mock.calls = []
  mockCreateClient.mock.calls = []
  mockCreateAdminClient.mock.calls = []

  authMock()
  setupProfileMock("c1")
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000"
})

afterEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL
})

describe("GET /api/download/zip (P4: ZIP download error handling)", () => {
  it("すべてのドキュメントダウンロードに失敗した場合は 500 エラーを返す（空ZIPを返さない）", async () => {
    const GET = await importZipRoute()

    setupDocumentsMock([
      { docType: "bcp_full", fileUrl: "bcp_full_v1.pdf", version: 1 },
      { docType: "action_manual", fileUrl: "action_manual_v1.pdf", version: 1 },
    ])
    setupStorageDownloadAllFail()

    const url = new URL("http://localhost:3000/api/download/zip")
    url.searchParams.set("company_id", "c1")
    url.searchParams.set("version", "1")

    const req = new Request(url.toString(), { method: "GET" })
    const res = await GET(req as Request)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toContain("すべて失敗")
  })

  it("一部のドキュメントダウンロードに失敗した場合は成功分のみを含むZIPを200で返す", async () => {
    const GET = await importZipRoute()

    setupDocumentsMock([
      { docType: "bcp_full", fileUrl: "bcp_full_v1.pdf", version: 1 },
      { docType: "action_manual", fileUrl: "action_manual_v1.pdf", version: 1 },
    ])

    // 1件目は成功、2件目は失敗
    mockStorageDownload
      .mockResolvedValueOnce({
        data: { arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)) },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { message: "Not found" } })

    const url = new URL("http://localhost:3000/api/download/zip")
    url.searchParams.set("company_id", "c1")
    url.searchParams.set("version", "1")

    const req = new Request(url.toString(), { method: "GET" })
    const res = await GET(req as Request)

    expect(res.status).toBe(200)
  })
})
