# fastbcp

Next.js 16 に基づく BCP（事業継続計画）関連 Web アプリケーションです。

## 概要

fastbcp は、災害時の事業継続を支援する機能を持つ Web アプリです。Next.js 16（App Router）、Supabase、Stripe、React Hook Form、shadcn/ui を構成としています。

PDF 生成機能（`@react-pdf/renderer`）により、日本語フォント（Noto Sans JP）を同梱して出力できます。

## 主な機能

- 認証（ログイン / サインアップ）
- ダッシュボード
- BCP ウィザードによる計画作成
- Stripe による決済処理
- PDF 出力（日本語対応）

## 技術スタック

| カテゴリ | 技術 |
|----------|------|
| フレームワーク | Next.js 16.4.3 |
| UI | React 19.3.0, shadcn/ui, Tailwind CSS 4 |
| フォーム | React Hook Form, Zod |
| バックエンド（BaaS） | Supabase |
| 決済 | Stripe |
| PDF 生成 | @react-pdf/renderer |
| テスト | Vitest, jsdom, Testing Library |
| 言語 | TypeScript |

## ディレクトリ構成

```
src/
  app/          # Next.js App Router ページ・API ルート
  components/   # React コンポーネント（ui / pdf / bcp-wizard / shared）
  hooks/        # カスタムフック
  lib/          # Supabase / Stripe / PDF / バリデーション / ユーティリティ
  proxy.ts      # プロキシ設定
  types/        # TypeScript 型定義
supabase/       # Supabase 関連ファイル
public/         # 静的アセット（フォント等）
```

## セットアップ

### 前提条件

- Node.js 20 以上
- npm / pnpm / bun / yarn のいずれか

### インストール

```bash
npm install
```

### 環境変数

`.env.example` をコピーして `.env.local` を作成し、必要な値を設定してください。

```bash
cp .env.example .env.local
```

`.env.local` は `.gitignore` でバージョン管理から除外されています。API キーなどの秘密情報をコミットしないようご注意ください。

### 開発サーバー起動

```bash
npm run dev
```

`http://localhost:3000` でアプリにアクセスできます。

### ビルド

```bash
npm run build
```

### リンク

```bash
npm run lint
```

### テスト

```bash
npm test
```

## フォント（PDF 生成）

`public/fonts/NotoSansJP-{Regular,Bold}.ttf` は [Noto Sans JP](https://fonts.google.com/noto/specimen/Noto+Sans+JP)（SIL Open Font License 1.1）で、同梱・再配布が許諾されています。

## ライセンス

このプロジェクトの全著作権は作者に帰属します。詳細は [LICENSE](LICENSE) を参照してください。

## ドキュメント

- [マニュアル](MANUAL.md)
- [Q&A](QA.md)