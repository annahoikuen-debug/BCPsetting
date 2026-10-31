/**
 * 携帯用アクションカード（A4 縦・1 枚・8 分割折りたたみ用）。
 *
 * A4 1 枚を 8 分割（2 列 x 4 行）し、財布や社員証ケースに入るサイズ
 * に折りたたむことを想定。極小フォントで高密度にレイアウトし、
 * 避難時の持ち出しリスト・安否連絡基準・緊急連絡先を掲載する。
 */
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

export type PocketCardData = {
  companyName: string
  createdAt: string
  carryList: string[] // 避難時持ち出しリスト
  safetyCriteria: string[] // 家族・会社への安否連絡基準
  emergencyContacts: Array<{
    role: string
    name: string
    phone: string
  }>
}

const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#ffffff",
  },
  // ヘッダー（全体タイトル）
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: "#111827",
  },
  headerTitle: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 13,
    fontWeight: "bold",
    color: "#111827",
  },
  headerSub: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 7,
    color: "#6b7280",
  },
  headerCompany: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 7,
    fontWeight: "bold",
    color: "#111827",
  },
  // 8 分割グリッド（2 列 x 4 行）
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 6,
    paddingTop: 8,
    paddingBottom: 8,
  },
  // 各パネル（8 つのうち 1 つ）
  panel: {
    width: "50%",
    height: "25%",
    padding: 6,
    borderWidth: 1,
    borderColor: "#d1d5db",
    boxSizing: "border-box",
  },
  panelTitle: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 8,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 2,
  },
  panelTitleCarry: {
    color: "#b91c1c",
  },
  panelTitleSafety: {
    color: "#166534",
  },
  panelTitleContact: {
    color: "#1e3a8a",
  },
  // リストアイテム
  listItem: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 6.5,
    color: "#111827",
    marginBottom: 2,
    lineHeight: 1.1,
  },
  listBullet: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 6.5,
    color: "#b91c1c",
    fontWeight: "bold",
    marginRight: 4,
    width: 8,
  },
  // 連絡先テーブル行
  contactRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  contactRole: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#374151",
    width: 34,
  },
  contactName: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 6.5,
    color: "#111827",
    width: 50,
  },
  contactPhone: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 6.5,
    color: "#111827",
    flex: 1,
  },
  // フッター（折り目ガイド）
  footer: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 6,
    color: "#9ca3af",
  },
  foldGuide: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 6,
    fontWeight: "bold",
    color: "#fbbf24",
  },
})

export function PocketCardDocument({
  data,
}: {
  data: PocketCardData
}) {
  return (
    <Document>
      <Page size="A4" orientation="portrait" style={styles.page}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>
              携帯用アクションカード
            </Text>
            <Text style={styles.headerSub}>
              避難時持ち出し・安否連絡・緊急連絡先（財布サイズ）
            </Text>
          </View>
          <Text style={styles.headerCompany}>
            {data.companyName}
          </Text>
        </View>

        {/* 8 分割グリッド */}
        <View style={styles.grid}>
          {/* パネル 1: 携帯用持ち出しリスト */}
          <View style={styles.panel}>
            <Text style={[styles.panelTitle, styles.panelTitleCarry]}>
              持ち出しリスト
            </Text>
            {data.carryList.map((item, i) => (
              <View key={i} style={styles.listItem}>
                <Text style={styles.listBullet}>▶</Text>
                <Text style={styles.listItem}>{item}</Text>
              </View>
            ))}
          </View>

          {/* パネル 2: 安否連絡基準（家族へ） */}
          <View style={styles.panel}>
            <Text style={[styles.panelTitle, styles.panelTitleSafety]}>
              家族への安否連絡
            </Text>
            {data.safetyCriteria.map((item, i) => (
              <View key={i} style={styles.listItem}>
                <Text style={styles.listBullet}>▶</Text>
                <Text style={styles.listItem}>{item}</Text>
              </View>
            ))}
          </View>

          {/* パネル 3: 安否連絡基準（会社へ） */}
          <View style={styles.panel}>
            <Text style={[styles.panelTitle, styles.panelTitleSafety]}>
              会社への安否連絡
            </Text>
            <View style={styles.listItem}>
              <Text style={styles.listBullet}>▶</Text>
              <Text style={styles.listItem}>
                安否確認ダイヤル：0120-XXXX-XXXX
              </Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.listBullet}>▶</Text>
              <Text style={styles.listItem}>
                連絡先：対策本部／総務部
              </Text>
            </View>
          </View>

          {/* パネル 4: 避難行動 */}
          <View style={styles.panel}>
            <Text style={[styles.panelTitle, styles.panelTitleCarry]}>
              避難時の行動
            </Text>
            <View style={styles.listItem}>
              <Text style={styles.listBullet}>▶</Text>
              <Text style={styles.listItem}>
                揺れがおさまったら落ち着いて避難
              </Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.listBullet}>▶</Text>
              <Text style={styles.listItem}>
                エレベーターは使わない（階段を使用）
              </Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.listBullet}>▶</Text>
              <Text style={styles.listItem}>
                指定避難所へ移動し、安否を報告
              </Text>
            </View>
          </View>

          {/* パネル 5-8: 緊急連絡先一覧（4 パネルに分割表示） */}
          {data.emergencyContacts.map((contact, i) => (
            <View key={i} style={styles.panel}>
              <Text style={[styles.panelTitle, styles.panelTitleContact]}>
                {contact.role}
              </Text>
              <View style={styles.contactRow}>
                <Text style={styles.contactRole}>{contact.role}</Text>
                <Text style={styles.contactName}>{contact.name}</Text>
                <Text style={styles.contactPhone}>{contact.phone}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* フッター：折り目ガイド */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {data.companyName}｜策定日：{data.createdAt}
          </Text>
          <Text style={styles.foldGuide}>
            折り目ガイド：A4 → 半分 → 半分 → 半分（8 分割）
          </Text>
        </View>
      </Page>
    </Document>
  )
}
