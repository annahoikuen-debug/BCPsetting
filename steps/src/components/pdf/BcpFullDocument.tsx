import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer"
import { getBcpFontFamily } from "@/lib/pdf/fonts"

// fonts モジュールの import 時にフォント登録が完了しているため、
// ここで確定したファミリ名を StyleSheet に使用する
const BCP_FONT_FAMILY = getBcpFontFamily()

// ============================================================================
// 型定義
// ============================================================================

export type BcpPdfCompany = {
  name: string
  representative: string
  industry: string
  address: string
  employeeScale: string
  establishedDate: string
}

export type BcpPdfData = {
  company: BcpPdfCompany
  policies: Array<{ type: string; priority: string; text: string }>
  risks: Array<{ type: string[]; impact: string; maxDowntimeDays: number }>
  coreBusinesses: Array<{ name: string; bottleneckEquipment: string[] }>
  responseSystem: {
    responseHead: string
    deputy: string
    safetyCheckPerson: string
    keyPartners: Array<{
      name: string
      jobTitle: string
      phone: string
      email: string
      roleType: string
    }>
  }
  preMeasures: {
    backupMethod: string
    stockpileItems: Array<{ name: string; stocked: boolean }>
    fundingPlan: string
    hasInsurance: boolean
  }
}

// ============================================================================
// スタイル定義
// ============================================================================

const styles = StyleSheet.create({
  // ページ共通
  page: {
    flexDirection: "column",
    backgroundColor: "#ffffff",
  },
  coverPage: {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    padding: 80,
    height: "100%",
  },
  // ヘッダー・フッター（表紙を除く各ページ）
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingTop: 30,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#cccccc",
  },
  headerCompany: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 9,
    fontWeight: "bold",
    color: "#333333",
  },
  headerDocTitle: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 9,
    color: "#666666",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingTop: 10,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: "#cccccc",
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 8,
    color: "#666666",
  },
  footerLeft: {},
  footerRight: {},
  // 表紙
  coverCompanyName: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 20,
    fontWeight: "bold",
    color: "#1a1a1a",
    textAlign: "center",
    marginBottom: 60,
  },
  coverTitle: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 32,
    fontWeight: "bold",
    color: "#1a1a1a",
    textAlign: "center",
    marginBottom: 10,
  },
  coverSubtitle: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 14,
    color: "#666666",
    textAlign: "center",
    marginBottom: 80,
  },
  coverFieldLabel: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 10,
    color: "#666666",
    marginBottom: 4,
  },
  coverFieldValue: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 14,
    color: "#1a1a1a",
    marginBottom: 20,
  },
  // 目次
  tocTitle: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 20,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 40,
  },
  tocItem: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 12,
    color: "#1a1a1a",
    marginBottom: 16,
    paddingLeft: 20,
  },
  tocItemNumber: {
    fontWeight: "bold",
    color: "#4a4a4a",
  },
  // 章タイトル
  chapterTitle: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 18,
    fontWeight: "bold",
    color: "#1a1a1a",
    borderBottomWidth: 2,
    borderBottomColor: "#1a1a1a",
    paddingBottom: 8,
    marginBottom: 24,
  },
  chapterSubtitle: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 13,
    fontWeight: "bold",
    color: "#4a4a4a",
    marginTop: 20,
    marginBottom: 10,
  },
  // 本文
  bodyText: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 9.5,
    color: "#1a1a1a",
    lineHeight: 1.6,
    marginBottom: 12,
    textAlign: "justify",
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  infoLabel: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#4a4a4a",
    width: 120,
  },
  infoValue: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 9.5,
    color: "#1a1a1a",
    flex: 1,
  },
  // チェックリスト
  checklistItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  checklistBox: {
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: "#1a1a1a",
    marginRight: 8,
    marginTop: 2,
  },
  checklistText: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 9.5,
    color: "#1a1a1a",
    flex: 1,
  },
})

// ============================================================================
// ヘッダー・フッター（表紙を除く各ページに描画）
// ============================================================================

type PageChromeProps = {
  companyName: string
  docTitle: string
}

function PageChrome({ companyName, docTitle }: PageChromeProps) {
  return (
    <>
      <View style={styles.header}>
        <Text style={styles.headerCompany}>{companyName}</Text>
        <Text style={styles.headerDocTitle}>{docTitle}</Text>
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerLeft}>事業継続計画書（BCP）</Text>
      </View>
    </>
  )
}

// ============================================================================
// 各章コンポーネント
// ============================================================================

function Chapter1({ data }: { data: BcpPdfData }) {
  const riskLabels: Record<string, string> = {
    地震: "震度6強の地震",
    水害: "風水害（台風・大雨・洪水等）",
    感染症: "感染症のまん延",
    その他: "その他",
  }

  return (
    <>
      <Text style={styles.chapterTitle}>第1章 基本方針と対象リスク</Text>

      <Text style={styles.chapterSubtitle}>1.1 基本方針</Text>
      {data.policies.map((policy, i) => (
        <View key={i} style={styles.infoRow}>
          <Text style={styles.infoLabel}>
            {policy.type}（優先度：{policy.priority}）
          </Text>
          <Text style={styles.infoValue}>{policy.text}</Text>
        </View>
      ))}

      <Text style={styles.chapterSubtitle}>1.2 対象リスクと被害想定</Text>
      {data.risks.map((risk, i) => (
        <View key={i} style={styles.infoRow}>
          <Text style={styles.infoLabel}>
            {risk.type.map((t) => riskLabels[t] ?? t).join("、")}
          </Text>
          <Text style={styles.infoValue}>
            被害想定：{risk.impact}｜業務停止許容日数：{risk.maxDowntimeDays}日
          </Text>
        </View>
      ))}
    </>
  )
}

function Chapter2({ data }: { data: BcpPdfData }) {
  return (
    <>
      <Text style={styles.chapterTitle}>第2章 中核事業と目標復旧時間</Text>

      {data.coreBusinesses.map((business, i) => (
        <View key={i} style={styles.infoRow}>
          <Text style={styles.infoLabel}>
            優先復旧業務 {i + 1}
          </Text>
          <Text style={styles.infoValue}>
            {business.name}（ボトルネック：
            {business.bottleneckEquipment.join("、") || "未設定"})
          </Text>
        </View>
      ))}
    </>
  )
}

function Chapter3({ data }: { data: BcpPdfData }) {
  const roleLabels: Record<string, string> = {
    本部長: "本部長",
    情報班: "情報班",
    避難誘導: "避難誘導",
  }

  return (
    <>
      <Text style={styles.chapterTitle}>
        第3章 発災時の初動体制・組織図
      </Text>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>対策本部長</Text>
        <Text style={styles.infoValue}>{data.responseSystem.responseHead}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>代理</Text>
        <Text style={styles.infoValue}>{data.responseSystem.deputy}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>安否確認担当</Text>
        <Text style={styles.infoValue}>
          {data.responseSystem.safetyCheckPerson}
        </Text>
      </View>

      <Text style={styles.chapterSubtitle}>3.1 緊急連絡網</Text>
      {data.responseSystem.keyPartners.map((partner, i) => (
        <View key={i} style={styles.infoRow}>
          <Text style={styles.infoLabel}>
            {partner.name}（{roleLabels[partner.roleType] ?? partner.roleType}）
          </Text>
          <Text style={styles.infoValue}>
            {partner.jobTitle}｜{partner.phone}｜{partner.email}
          </Text>
        </View>
      ))}
    </>
  )
}

function Chapter4({ data }: { data: BcpPdfData }) {
  return (
    <>
      <Text style={styles.chapterTitle}>
        第4章 事前対策（備蓄・データ保全・代替手段）
      </Text>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>データバックアップ方法</Text>
        <Text style={styles.infoValue}>{data.preMeasures.backupMethod}</Text>
      </View>

      <Text style={styles.chapterSubtitle}>4.1 備蓄品チェックリスト</Text>
      {data.preMeasures.stockpileItems.map((item, i) => (
        <View key={i} style={styles.checklistItem}>
          <View style={styles.checklistBox} />
          <Text style={styles.checklistText}>
            {item.name}（{item.stocked ? "備蓄済み" : "未備蓄"}）
          </Text>
        </View>
      ))}

      <Text style={styles.chapterSubtitle}>4.2 代替手段</Text>
      <Text style={styles.bodyText}>
        主要設備・IT ツールの代替手段として、クラウドサービスの冗長化、
        代替サプライヤーの確保、リモートワーク体制の整備を検討する。
      </Text>
    </>
  )
}

function Chapter5({ data }: { data: BcpPdfData }) {
  const fundingLabels: Record<string, string> = {
    自己資金: "自己資金",
    金融機関融資: "金融機関融資",
    "補助金・助成金": "補助金・助成金",
    未定: "未定",
  }

  return (
    <>
      <Text style={styles.chapterTitle}>
        第5章 財務対策・運用見直し計画
      </Text>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>資金手当て</Text>
        <Text style={styles.infoValue}>
          {fundingLabels[data.preMeasures.fundingPlan] ??
            data.preMeasures.fundingPlan}
        </Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>保険加入状況</Text>
        <Text style={styles.infoValue}>
          {data.preMeasures.hasInsurance ? "加入済み" : "未加入"}
        </Text>
      </View>

      <Text style={styles.chapterSubtitle}>5.1 運用見直し計画</Text>
      <Text style={styles.bodyText}>
        本計画は年1 回を目安に見直し、事業環境の変化や訓練結果を反映して
        更新する。見直しの際は、対策本部長を責任者とし、関係部署との
        協議の上で改訂版を発行する。
      </Text>
    </>
  )
}

// ============================================================================
// 各ページコンポーネント
// ============================================================================

function CoverPage({ data }: { data: BcpPdfData }) {
  return (
    <Page size="A4" style={styles.coverPage}>
      <Text style={styles.coverCompanyName}>{data.company.name}</Text>
      <Text style={styles.coverTitle}>事業継続計画書 (BCP)</Text>
      <Text style={styles.coverSubtitle}>対外提出・保管用 / A4 縦</Text>

      <View style={{ width: "100%", maxWidth: 400 }}>
        <View style={styles.infoRow}>
          <Text style={styles.coverFieldLabel}>策定日</Text>
          <Text style={styles.coverFieldValue}>
            {data.company.establishedDate}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.coverFieldLabel}>代表者名</Text>
          <Text style={styles.coverFieldValue}>
            {data.company.representative}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.coverFieldLabel}>業種</Text>
          <Text style={styles.coverFieldValue}>
            {data.company.industry}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.coverFieldLabel}>従業員数</Text>
          <Text style={styles.coverFieldValue}>
            {data.company.employeeScale}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.coverFieldLabel}>所在地</Text>
          <Text style={styles.coverFieldValue}>
            {data.company.address}
          </Text>
        </View>
      </View>
    </Page>
  )
}

function TocPage() {
  return (
    <Page size="A4" style={styles.page}>
      <PageChrome companyName="" docTitle="事業継続計画書（BCP）" />
      <View style={{ padding: 40, flexDirection: "column" }}>
        <Text style={styles.tocTitle}>目次</Text>
        <View style={{ marginTop: 20 }}>
          <Text style={styles.tocItem}>
            <Text style={styles.tocItemNumber}>第1章</Text> 基本方針と対象リスク
          </Text>
          <Text style={styles.tocItem}>
            <Text style={styles.tocItemNumber}>第2章</Text> 中核事業と目標復旧時間
          </Text>
          <Text style={styles.tocItem}>
            <Text style={styles.tocItemNumber}>第3章</Text>
            発災時の初動体制・組織図
          </Text>
          <Text style={styles.tocItem}>
            <Text style={styles.tocItemNumber}>第4章</Text>
            事前対策（備蓄・データ保全・代替手段）
          </Text>
          <Text style={styles.tocItem}>
            <Text style={styles.tocItemNumber}>第5章</Text> 財務対策・運用見直し計画
          </Text>
        </View>
        <Text style={{
          marginTop: 60,
          fontFamily: BCP_FONT_FAMILY,
          fontSize: 8,
          color: "#999999",
        }}>
          ※ 本書は FastBCP により自動生成された事業継続計画書です。
        </Text>
      </View>
    </Page>
  )
}

function ChapterPage({
  chapter,
  data,
}: {
  chapter: number
  data: BcpPdfData
}) {
  return (
    <Page size="A4" style={styles.page}>
      <PageChrome companyName={data.company.name} docTitle="事業継続計画書（BCP）" />
      <View style={{ padding: 40, flexDirection: "column" }}>
        {chapter === 1 && <Chapter1 data={data} />}
        {chapter === 2 && <Chapter2 data={data} />}
        {chapter === 3 && <Chapter3 data={data} />}
        {chapter === 4 && <Chapter4 data={data} />}
        {chapter === 5 && <Chapter5 data={data} />}
      </View>
    </Page>
  )
}

// ============================================================================
// メインドキュメントコンポーネント
// ============================================================================

export function BcpFullDocument({ data }: { data: BcpPdfData }) {
  return (
    <Document>
      <CoverPage data={data} />
      <TocPage />
      <ChapterPage chapter={1} data={data} />
      <ChapterPage chapter={2} data={data} />
      <ChapterPage chapter={3} data={data} />
      <ChapterPage chapter={4} data={data} />
      <ChapterPage chapter={5} data={data} />
    </Document>
  )
}
