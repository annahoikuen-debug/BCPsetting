# マニュアル（fastbcp）

本マニュアルは、fastbcp の利用方法・開発方法・デプロイ方法について解説します。

---

## 1. はじめに

fastbcp は、BCP（事業継続計画）策定・運用を支援する Web アプリケーションです。Next.js 16 をベースに、Supabase をバックエンド、Stripe を決済基盤として利用します。

### 想定ユーザー

- BCP 担当者（計画の作成・閲覧）
- システム管理者（環境構築・運用）
- 開発者（コードの改修・拡張）

---

## 2. 環境構築

### 2.1 必要なソフトウェア

- Node.js 20 以上
- npm（または pnpm / bun / yarn）
- Git
- Supabase プロジェクト（アカウント作成済みであること）
- Stripe アカウント（テストモード / ライブモード）

### 2.2 リポジトリのクローン

```bash
git clone https://github.com/annahoikuen-debug/BCPsetting.git
cd BCPsetting/steps
```

### 2.3 依存パッケージのインストール

```bash
npm install
```

### 2.4 環境変数の設定

`.env.example` をコピーして `.env.local` を作成します。

```bash
cp .env.example .env.local
```

`.env.local` に以下の値を設定してください（例）：

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

> `.env.local` は `.gitignore` で除外されており、リポジトリにコミットされません。API キーなどの秘密情報をコミットしないようご注意ください。

### 2.5 開発サーバーの起動

```bash
npm run dev
```

ブラウザで `http://localhost:3000` にアクセスするとアプリが表示されます。

---

## 3. 主な機能の使い方

### 3.1 認証（ログイン / サインアップ）

- `/login`：既存ユーザーのログイン
- `/signup`：新規ユーザーの登録

Supabase Auth を利用しています。メールアドレスとパスワードで認証を行います。

### 3.2 ダッシュボード

- `/dashboard`：ログイン後のメイン画面。BCP 計画の一覧・作成・編集を行います。

### 3.3 BCP ウィザード

- `/wizard`：ステップ形式のフォームで BCP 計画を作成します。入力内容は React Hook Form + Zod でバリデーションされます。

### 3.4 決済（Stripe）

- `/checkout`：Stripe Checkout を利用した有料プランの購入フローです。

### 3.5 PDF 出力

- `@react-pdf/renderer` を用いて、入力内容を PDF として出力できます。
- 日本語フォント `Noto Sans JP` が `public/fonts/` に同梱されており、日本語の文字化けを防いでいます。

---

## 4. プロジェクト構造

```
src/
  app/
    actions/    # サーバーアクション（Supabase 操作など）
    api/        # API ルート（Webhook 等）
    auth/       # 認証関連ページ
    checkout/   # 決済フローページ
    dashboard/  # ダッシュボードページ
    login/      # ログインページ
    signup/     # サインアップページ
    wizard/     # BCP ウィザードページ
    layout.tsx  # ルートレイアウト
    page.tsx    # トップページ
    globals.css # グローバルスタイル
  components/
    ui/         # shadcn/ui ベースの共通 UI コンポーネント
    pdf/        # PDF レンダリングコンポーネント
    bcp-wizard/ # ウィザード固有コンポーネント
    shared/     # 共通コンポーネント
  hooks/        # カスタムフック
  lib/
    supabase/   # Supabase クライアント初期化
    stripe/     # Stripe クライアント初期化
    pdf/        # PDF 生成ロジック
    validations/# Zod スキーマ
    utils.ts    # 汎用ユーティリティ
  proxy.ts      # プロキシ設定
  types/        # TypeScript 型定義
supabase/       # Supabase マイグレーション・設定ファイル
public/         # 静的アセット（フォント、画像等）
```

---

## 5. テスト

Vitest を使用してテストを実行します。

```bash
npm test
```

単体テスト・コンポーネントテストを `src` 配下または `tests` ディレクトリに配置してください。

---

## 6. ビルドとデプロイ

### 6.1 プロダクションビルド

```bash
npm run build
```

### 6.2 デプロイ（Vercel 推奨）

Next.js 公式のデプロイプラットフォームである Vercel へのデプロイが推奨されます。

```bash
npx vercel
```

環境変数は Vercel プロジェクト設定の「Environment Variables」から追加してください。

---

## 7. ライセンス

このプロジェクトは「All Rights Reserved（全権利保持）」の下で配布されています。詳細は [LICENSE](LICENSE) を参照してください。

---

## 8. お問い合わせ

不具合・ご要望・ご質問は、GitHub リポジトリの Issues または Pull Request でお知らせください。