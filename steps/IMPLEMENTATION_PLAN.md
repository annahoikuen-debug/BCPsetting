# FastBCP 実装計画書（コードレビュー対応）

## 目的

このプロジェクト（Next.js 16 / App Router + Supabase + Stripe）に対し、実施済みのコードレビューで判明した全指摘を修正し、リリース品質を担保する。

レビューは 3 軸（フロントエンド・ウィザード・認証 / PDF 生成・決済フロー / ミドルウェア・バックエンド）で実施済み。主な致命的問題は以下の通り：

- **Critical**: ウィザード下書きフックの無限ループ、ステップ3のレンダークラッシュ、ステップ2〜5の入力未登録、ステップ5/6のドラフト未復元、`searchParams` の Next.js 16 非対応（決済完了ページが常にリダイレクト）、PDF フォント未配置によるレンダー失敗、snake_case/camelCase JSONB マッピング不整合によるクラッシュ
- **High**: Webhook のセッションクライアントによる RLS バイパス操作、決済完了ページの認証・購入ゲート欠如、冪等性欠如による重複発行、365日署名付きURLの DB 永続化、ZIPリンクの会社名/バージョン破損、PDF プレビューの認証・バリデーション欠如

## 規約

- すべてのステップは **小さな単一変更** に留め、1 ステップ = 1 つのファイルまたは 1 つの関数の修正を原則とする。
- 各ステップ完了後、`npm run lint` と `npx tsc --noEmit` を実行し、警告・エラーが新規に発生しないことを確認する。
- 修正後の挙動はブラウザまたは `next dev` で実際に動作確認する（ゴールデンパス + エッジケース）。
- コードに日本語コメントを追加する場合は「なぜその修正が必要か（WHY）」のみ記述し、何をしているかはコードで表現する。

## ステップ一覧（全36ステップ）

### フェーズ A：致命的バグ修正（リリースブロッカー、Critical）

| # | タイトル | 優先度 | 対象ファイル | やること | 完了基準 |
|---|----------|--------|--------------|----------|----------|
| 1 | `useLocalStorageDraft` の無限ループ修正 | Critical | `src/hooks/useLocalStorageDraft.ts` | `useCallback(() => {...}, [key])()` を `useEffect(() => {...}, [key])` または `useState` の遅延イニシャライザに変更し、レンダーごとに復元処理が走らないようにする。 | ページリロード後、「Maximum update depth exceeded」が発生せず、保存済みドラフトが正しく復元される。 |
| 2 | ステップ3（想定リスク）のレンダークラッシュ修正 | Critical | `src/components/bcp-wizard/risk-field-item.tsx` | `field.value.maxDowntimeDays` など `field` に存在しないプロパティ参照をやめ、`form.getValues` / `form.setValue` で読み書きする。 | ステップ3が白画面にならず、リスク項目の追加・編集・保存が可能。 |
| 3 | ステップ2/3/4/5のテキスト入力未登録修正 | Critical | `step2.tsx`, `risk-field-item.tsx`, `step4.tsx`, `step5.tsx` | `<Input {...field} />`（field-arrayデータをDOM属性に展開）をやめ、`{...form.register('policies.0.text')} defaultValue={field.text}` または `Controller` で React Hook Form に登録する。 | 各ステップのテキスト入力値がフォーム状態に反映され、Zodバリデーションを通過して保存できる。 |
| 4 | ステップ5/6のドラフト未復元修正 | Critical | `step5.tsx`, `step6.tsx` | `useForm({ ...defaultValues })` のオプション展開をやめ、`defaultValues: { ...defaultValues, ... }` の中でスプレッドする。 | ステップ5/6へ遷移時に、localStorage/DBから保存済みドラフトが復元される。 |
| 5 | ログイン/サインアップのサーバーアクション結果をUIに反映 | Critical | `login/page.tsx`, `signup/page.tsx`, `src/app/actions/auth.ts` | `useActionState` を導入し、`signin`/`signup` の戻り値（`error._form`、`requiresConfirmation` など）を画面に表示する。 | 認証失敗時にエラーメッセージが表示され、メール確認必要時の案内が表示される。 |
| 6 | `middleware.ts` → `proxy.ts` へ移行（Next.js 16） | Critical | `src/middleware.ts` → `src/proxy.ts` | ファイル名を `proxy.ts` に変更し、エクスポート名を `proxy` にする。`@supabase/ssr` のクッキー更新パターン（`request.cookies` への書き戻し＋新規 `NextResponse.next({ request })`）を適用。 | `next dev` 起動時に非推奨警告が出ず、認証状態のリダイレクトが正常に動作。 |
| 7 | 決済完了ページの `searchParams` Promise 対応 | Critical | `src/app/checkout/success/page.tsx` | `searchParams` を `Promise<{ session_id?: string }>` と型付けし、`await searchParams` してから `session_id` を参照する。 | 決済完了URLにアクセスすると決済検証・PDF生成が実行され、常に `/wizard/summary` へリダイレクトされなくなる。 |
| 8 | PDFフォントの登録とファイル配置 | Critical | `src/lib/pdf/fonts.ts`, `public/fonts/` | `public/fonts/NotoSansJP-Regular.ttf`, `NotoSansJP-Bold.ttf` を配置。`Font.register` の `src` をルート相対URL（Nodeのfetch不可）から絶対ファイルパスまたはバッファに変更。 | `renderToBuffer` がフォントエラーで失敗せず、日本語が文字化けせずにPDF生成される。 |
| 9 | JSONBのsnake_case/camelCase不整合を正規化 | Critical | `src/app/actions/bcp.ts`, `src/app/checkout/success/page.tsx`, `src/types/bcp.ts` | ウィザード入力はcamelCaseで保存。PDF変換側（`toBcpPdfData`）はsnake_case読みをやめ、書き込み時点で `bcpWizardInputSchema.parse` で正規化し、PDF変換は単一のカメルケース形状を参照する。 | PDF生成時に `b.bottleneck_equipment` 等が `undefined` にならず、リスク/パートナー/財務項目が正しく出力される。 |

### フェーズ B：データ整合性・セキュリティ（High）

| # | タイトル | 優先度 | 対象ファイル | やること | 完了基準 |
|---|----------|--------|--------------|----------|----------|
| 10 | `upsertBcpDraft` にサーバーサイドZodバリデーション追加 | High | `src/app/actions/bcp.ts`, `src/lib/validations/bcp.ts` | 型のみの `BcpWizardInput` をやめ、`bcpWizardInputSchema.parse(data)` でサーバー側からバリデートし、不正なJSONBをDBに書き込まない。 | 不正な形状のリクエストは `400` 相当のエラーを返し、DBに汚染データが残らない。 |
| 11 | ステップ1（会社基本情報）のDB保存と取得 | High | `src/app/actions/bcp.ts`, `src/app/actions/auth.ts`, `supabase/migrations/001_initial_schema.sql` | `companies` テーブルに `industry`/`employee_scale` 等を保存する経路を作り、`getBcpDraft` がハードコードデフォルトを返さずDBから取得する。 | ウィザード完了後のサマリーに、ユーザー入力の会社名・業種・従業員数が表示される。 |
| 12 | Stripe Webhookでサービスロールクライアントを使用 | High | `src/app/api/webhooks/stripe/route.ts` | `createClient()`（セッションクライアント）を `createAdminClient()` に変更し、RLSをバイパスして `companies`/`orders` を更新する。 | Webhook受信時に権限エラーで失敗せず、購入フラグ・サブスクリプション状態が正しく更新される。 |
| 13 | 決済完了ページに認証チェックと購入ゲート追加 | High | `src/app/checkout/success/page.tsx` | `processPayment` の冒頭で `supabase.auth.getUser()` を呼び、`session.metadata.user_id` と `profile.company_id` を突合。不一致時は403。 | 他社の決済セッションIDをURLに入力しても、自社のPDFが生成・ダウンロードできなくなる。 |
| 14 | 決済セッションの冪等性チェック（重複発行防止） | High | `src/app/checkout/success/page.tsx`, `supabase/migrations/001_initial_schema.sql` | `orders.stripe_session_id` のユニーク制約を活用し、既に処理済みのセッションIDならPDF再生成をスキップ。 | 成功URLのリフレッシュや重複アクセスで `generated_documents` 行が重複挿入されない。 |
| 15 | `document_version` の原子的インクリメント | High | `src/app/checkout/success/page.tsx` | バージョン取得→インクリメント→更新をトランザクションまたはRPCで一括実行し、競合による同バージョン発行を防ぐ。 | 同時アクセスでもバージョンが重複せず、ファイルが上書きされない。 |
| 16 | 決済完了後のDB更新（steps 10-11）のエラーハンドリング | High | `src/app/checkout/success/page.tsx` | `document_version` 更新と `is_completed` 更新の結果をチェックし、失敗時はエラーを返す。 | PDF生成成功後にステータスが不整合にならない。 |
| 17 | ZIPダウンロードリンクの会社ID・バージョン修正 | High | `src/app/checkout/success/page.tsx`, `src/app/api/download/zip/route.ts` | `companyIdEncoded(companyName)`（会社名を渡す）を実際の `companyId` に変更し、`version` も `currentVersion` を渡す。 | ZIPダウンロード時に所有権チェックが通り、正しいバージョンのファイルが取得できる。 |
| 18 | `/api/pdf/preview` に認証とバリデーション追加 | High | `src/app/api/pdf/preview/route.ts` | `supabase.auth.getUser()` で認証を必須化し、ボディを `zod` スキーマでバリデート。レート制限またはサイズ制限を検討。 | 未ログインからの任意PDF生成リクエストが拒否され、不正ボディで500エラーにならない。 |
| 19 | `file_url` の365日署名付きURL永続化を廃止 | High | `src/app/checkout/success/page.tsx`, `src/app/api/download/zip/route.ts`, `src/app/dashboard/page.tsx` | DBに署名付きURLを保存せず、ストレージパスのみ保存。ダウンロード時に短時間署名付きURLを発行するか、認証付きプロキシ経由で配信。 | 漏洩したURLが1年間有効にならず、ストレージの非公開性が担保される。 |
| 20 | ダッシュボードの編集期間判定を `purchased_at` ベースに変更 | High | `src/app/dashboard/page.tsx` | 編集可能期間（購入後7日間）の基準を `company.created_at` から `company.purchased_at` に変更。 | 購入日を起点とした正しい編集期限が表示される。 |
| 21 | ダッシュボードの `company.is_completed` 参照エラー修正 | High | `src/app/dashboard/page.tsx` | 存在しない `company.is_completed` を参照をやめ、`bcp_inputs.is_completed` から取得する。 | ダッシュボードの「策定ステータス」が正しく表示され、ランタイムエラーが発生しない。 |

### フェーズ C：UX・安定性（Medium）

| # | タイトル | 優先度 | 対象ファイル | やること | 完了基準 |
|---|----------|--------|--------------|----------|----------|
| 22 | サインアップの原子性確保（失敗時ロールバック） | Medium | `src/app/actions/auth.ts` | Authユーザー作成→会社作成→プロファイル作成のいずれかが失敗した際、作成済みのAuthユーザーを削除するなど整合性を保つ。 | サインアップ中途失敗で「既に登録済み」状態にならず、再試行が可能。 |
| 23 | 多重ハザード選択を `string[]` で保存 | Medium | `src/components/bcp-wizard/risk-field-item.tsx`, `src/lib/validations/bcp.ts` | `"地震,水害"` のようなカンマ区切り文字列をやめ、`z.enum` を `z.array(z.enum(...))` に変更し配列で保存。 | 複数リスク選択時にバリデーションエラーにならず、データが正しく保存される。 |
| 24 | ステップ4「その他」入力のコミットタイミング修正 | Medium | `src/components/bcp-wizard/step4.tsx` | 入力中に `bottleneckEquipment` にプレフィックスを累積させる実装をやめ、blur/Enterで確定する。 | 「その他」の自由入力が「A」「AB」「ABC」のように破損しない。 |
| 25 | ステップ1のバリデーションエラー表示修正 | Medium | `src/components/bcp-wizard/step1.tsx`, `src/components/ui/field.tsx` | 空の `<FieldError />` をやめ、`errors` または `children` を渡してZodエラーメッセージを表示。 | HTML `required` 以外のバリデーションエラー（業種未選択など）が画面に表示され、 submit ブロックの理由が分かる。 |
| 26 | ヘッダーに認証リンク（ログイン/ログアウト/ダッシュボード）追加 | Medium | `src/components/shared/header.tsx`, `src/app/actions/auth.ts` | `signout` サーバーアクションをUIから呼べるようにし、未認証時はログイン・認証済み時はダッシュボード/ログアウトを表示。 | ヘッダーから認証状態に応じたナビゲーションが可能。 |
| 27 | ミドルウェアのクッキーリフレッシュパターン適用 | Medium | `src/proxy.ts` | `@supabase/ssr` 公式パターンに従い、トークンリフレッシュ時に `request.cookies` へ書き戻し＋新規 `NextResponse.next({ request })` を返す。 | セッション更新後も下流のサーバーコンポーネントで最新クッキーが反映される。 |
| 28 | ウィザードの未送信入力を `form.watch` + debounce で自動保存 | Medium | `src/app/wizard/page.tsx` | `onStepComplete` だけでなく、編集中の入力も `form.watch` と debounce で localStorage/DB に保存し、「戻る」でデータが消えないようにする。 | ステップ間を往復しても、未送信の入力内容が失われない。 |
| 29 | `handleSubmitAll` の成功フィードバックとリダイレクト | Medium | `src/app/wizard/page.tsx` | 偽の800ms遅延をやめ、保存成功時にダイアログを閉じて `/wizard/summary` へリダイレクト。`companyId` が null の場合は保存ボタンを無効化。 | 保存完了後、ユーザーに結果が伝わりサマリーページへ遷移する。 |
| 30 | サマリーページを実データ表示化＋ `/wizard?step=N` リンク | Medium | `src/app/wizard/summary/page.tsx`, `src/app/actions/bcp.ts` | `getBcpDraft` でDBからドラフトを取得し表示。各ステップの「編集」リンクを `/wizard?step=N` に変更し、該当ステップから開始する。 | ハードコードされたプレースホルダデータではなく、ユーザー自身の入力内容が表示される。 |
| 31 | サマリーページの決済ボタンを `/api/checkout` に接続 | Medium | `src/app/wizard/summary/page.tsx`, `src/app/api/checkout/route.ts` | ダイアログ内の硬直価格（¥5,000/¥3,000）をやめ、Stripe価格IDから動的に取得し、決済ボタンを `/api/checkout` または `/api/subscribe/checkout` に接続。 | 決済ボタン押下時に実際のStripeチェックアウトセッションが作成される。 |
| 32 | OAuthコールバックで `error` / `next` パラメータを処理 | Medium | `src/app/auth/callback/page.tsx`, `src/middleware.ts`（または `proxy.ts`） | OAuthエラー・`error_description` を表示し、`next` パラメータを same-origin パスとして検証してリダイレクト先に使用。 | 認証失敗時にエラーメッセージが表示され、元の意図したページへ戻れる。 |

### フェーズ D：仕上げ（Low）

| # | タイトル | 優先度 | 対象ファイル | やること | 完了基準 |
|---|----------|--------|--------------|----------|----------|
| 33 | `google-signin-button` の `decodeURIComponent` 除去 | Low | `src/components/shared/google-signin-button.tsx` | `URLSearchParams` で既にデコード済みの値に `decodeURIComponent` を適用しない。例外発生を防ぐ。 | GoogleサインインボタンがURIErrorでクラッシュしない。 |
| 34 | ウィザードの「保存完了→アイドル」タイマー競合修正 | Low | `src/app/wizard/page.tsx` | 3秒タイマーが新しい「保存中」状態を上書きしないようにし、コンポーネントunmount時にタイマーをクリア。 | 連打保存時の状態チラつきがなくなり、メモリリークも防止。 |
| 35 | サマリーページの button-in-button 無効HTML修正 | Low | `src/app/wizard/summary/page.tsx` | `<Button asChild><Link/></Button>` を `AccordionTrigger` のボタン内部に入れ子にしない。リンクは `Button` の外または `asChild` の対象を1つに統一。 | HTMLとして妥当なボタン構造になり、クリック挙動が正常。 |
| 36 | PDF内の絵文字・プレースホルダテキスト除去 | Low | `src/components/pdf/PocketCardDocument.tsx`, `src/components/pdf/ActionManualDocument.tsx`, `src/app/checkout/success/page.tsx` | 顧客向けPDFに出る絵文字（フォントにグリフなし→豆腐文字）と、「ページ番号はフッターに自動挿入されます」といった開発者メモを除去。 | 顧客向けPDFに不適切な文字や開発メモが含まれなくなる。 |

## 定義の完了（Definition of DoD）

全36ステップ完了時点で、以下を満たす：

1. `npm run lint` で **新規エラー・警告がゼロ**（既存警告は既知のもののみ許容）。
2. `npx tsc --noEmit` がエラーゼロ。
3. `next dev` 起動後、以下のゴールデンパスがブラウザで動作確認済み：
   - ユーザー登録 → ログイン → ウィザード6ステップ完了 → ドラフト保存 → サマリー表示 → 決済 → PDF生成・ダウンロード → ダッシュボードで再ダウンロード。
4. 決済完了ページをリフレッシュしても二重発行・バージョン重複が発生しない。
5. 他社の `session_id` や `company_id` を指定したリクエストが403で拒否される。
6. Stripe Webhook受信時に購入フラグ・サブスクリプション状態が正しく更新される。

## 推奨実行順序

ステップ1〜9（Critical）を先に完了させ、アプリがクラッシュせず決済フローが実行可能な状態にする。その後10〜21（High）でセキュリティとデータ整合性を担保し、22〜32（Medium）でUXを整え、33〜36（Low）で仕上げる。

## 検証コマンド

```bash
# 型チェック
npx tsc --noEmit

# Lint
npm run lint

# 開発サーバー起動（動作確認用）
npm run dev
```

## 補足

- ステップ6の `middleware-to-proxy` 移行は、Next.js 16 公式ドキュメント（`node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`）に準拠。
- ステップ8のフォントファイル（Noto Sans JP TTF）は、ライセンス許容範囲内でプロジェクトにコミットするか、別途入手手順を `README.md` に記載する。
- ステップ19の代替案として、ダウンロード用の認証付きAPIルート（`/api/download/:docType`）を新設し、ストレージの非公開性を維持する方法も検討可能。

---

## リグレッション防止計画

### 基本原則

1. **1ステップ = 1コミット**。各ステップを独立した最小コミット単位で実施し、問題発生時に `git revert` または `git reset` で直前に戻せるようにする。
2. **各ステップ完了後に必須検証**を実施。検証をパスしない場合は次のステップに進まない。
3. **関連ページをすべて巡回**し、既存の動作が壊れていないことを確認する。

### 各ステップの検証チェックリスト

| 項目 | コマンド / 手順 | 合格基準 |
|------|----------------|----------|
| 型チェック | `npx tsc --noEmit` | エラーゼロ |
| Lint | `npm run lint` | 新規エラー・警告ゼロ（既存警告は既知のもののみ） |
| 開発サーバー起動 | `npm run dev` | エラーなく起動し、`/`、`/wizard`、`/dashboard`、`/login`、`/signup` にアクセスできる |
| ブラウザ動作確認 | ブラウザで該当ページを開く | 該当機能が期待通り動作し、コンソールにJSエラーが出ない |
| エッジケース | 未ログイン / 不正パラメータ / 空データ | 適切なエラーまたはリダイレクトが返る |

### フェーズごとの中間チェックポイント

| チェックポイント | 対象 | 確認項目 |
|-----------------|------|----------|
| CP-A | ステップ1〜9完了後 | ウィザード6ステップがクラッシュなく完遂、決済完了ページが `session_id` なしで常時リダイレクトしない、PDF生成がフォントエラーなく成功 |
| CP-B | ステップ10〜21完了後 | Webhookで購入フラグ・サブスクリプション状態が正しく更新、決済完了ページに認証チェックあり、ZIPリンクが正しく動作 |
| CP-C | ステップ22〜32完了後 | サインアップ失敗時のロールバック、サマリーページに実データ表示、決済ボタンがStripeに接続 |
| CP-D | ステップ33〜36完了後 | 全36ステップ完了、最終ブラウザE2E確認 |

### ロールバック手順

問題が発生した場合：

```bash
# 直前のコミットを取り消し（作業ディレクトリの変更は保持）
git reset --soft HEAD~1

# またはコミットごと完全に元に戻す
git revert HEAD
```

`.env.local`、`node_modules/`、`.next/` はコミット対象外とし、環境構築に影響させない。

### リグレッション監視対象（リリース前最終確認）

以下のゴールデンパスをすべてブラウザで実行し、エラーがないことを確認：

1. ユーザー新規登録 → メール確認案内表示 → ログイン
2. ウィザード6ステップすべて入力 → ドラフト自動保存 → 「戻る」でデータが消えない
3. サマリーページで自分の入力内容が表示される
4. 決済ボタン押下 → Stripe Checkout に遷移 → 決済完了 → PDF生成・ダウンロード
5. ダッシュボードで発行済みドキュメントが一覧表示され、再ダウンロード可能
6. 決済完了URLをリフレッシュしても二重発行・バージョン重複が発生しない
7. 他社の `company_id` / `session_id` を指定しても403で拒否される

### 禁止事項

- 複数ステップをまとめて1つのコミットにしない
- 検証をパスしないまま次のステップに進まない
- `node_modules/` や `.env.local` をコミットに含めない