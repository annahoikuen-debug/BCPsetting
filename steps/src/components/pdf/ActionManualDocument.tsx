/**
 * 非常時初動対応マニュアル（A4 横・1 枚）。
 *
 * 現場にそのまま掲示・ラミネートできる視認性重視のレイアウト。
 * 発災直後（0〜10 分）、当日（〜24 時間）、翌日以降のタイムライン別
 * アクションフローと緊急連絡網を 1 枚にまとめる。
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

export type ActionManualData = {
  companyName: string
  createdAt: string
  phases: {
    immediate: string[] // 0〜10 分
    sameDay: string[] // 当日〜24 時間
    nextDayPlus: string[] // 翌日以降
  }
  emergencyContacts: Array<{
    role: string
    name: string
    phone: string
    email?: string
  }>
}

const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#ffffff",
    width: "100%",
    height: "100%",
  },
  // ヘッダー
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 30,
    paddingTop: 20,
    paddingBottom: 15,
    borderBottomWidth: 4,
    borderBottomColor: "#b91c1c",
  },
  headerTitle: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 22,
    fontWeight: "bold",
    color: "#b91c1c",
  },
  headerSub: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 10,
    color: "#374151",
    marginTop: 4,
  },
  headerCompany: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 10,
    fontWeight: "bold",
    color: "#111827",
  },
  // メインコンテンツ
  content: {
    flexDirection: "column",
    paddingHorizontal: 30,
    paddingTop: 20,
    paddingBottom: 20,
    flex: 1,
  },
  // フェーズブロック
  phaseSection: {
    marginBottom: 20,
  },
  phaseHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    padding: 8,
    borderRadius: 4,
  },
  phaseImmediate: {
    backgroundColor: "#fee2e2",
    borderLeftWidth: 6,
    borderLeftColor: "#dc2626",
  },
  phaseSameDay: {
    backgroundColor: "#fef3c7",
    borderLeftWidth: 6,
    borderLeftColor: "#d97706",
  },
  phaseNextDay: {
    backgroundColor: "#dcfce7",
    borderLeftWidth: 6,
    borderLeftColor: "#16a34a",
  },
  phaseTitle: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 13,
    fontWeight: "bold",
    marginRight: 8,
  },
  phaseImmediateTitle: {
    color: "#991b1b",
  },
  phaseSameDayTitle: {
    color: "#92400e",
  },
  phaseNextDayTitle: {
    color: "#14532d",
  },
  phaseSubtitle: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 8.5,
    color: "#6b7280",
  },
  phaseActions: {
    marginLeft: 14,
    marginBottom: 4,
  },
  actionItem: {
    flexDirection: "row",
    marginBottom: 3,
  },
  actionBullet: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 9,
    color: "#b91c1c",
    fontWeight: "bold",
    marginRight: 6,
    width: 12,
  },
  actionText: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 9,
    color: "#111827",
    flex: 1,
  },
  // 連絡網セクション
  contactSection: {
    marginTop: 4,
    padding: 10,
    backgroundColor: "#f3f4f6",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  contactTitle: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 11,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 6,
  },
  contactTable: {
    width: "100%",
  },
  contactRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  contactRole: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#374151",
    width: 70,
  },
  contactName: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 9,
    color: "#111827",
    width: 90,
  },
  contactPhone: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 9,
    color: "#111827",
    width: 110,
  },
  contactEmail: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 8.5,
    color: "#6b7280",
  },
  // フッター
  footer: {
    paddingHorizontal: 30,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontFamily: BCP_FONT_FAMILY,
    fontSize: 7.5,
    color: "#6b7280",
  },
})

function PhaseBlock({
  title,
  subtitle,
  actions,
  phaseStyle,
  titleStyle,
}: {
  title: string
  subtitle: string
  actions: string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  phaseStyle: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  titleStyle: any
}) {
  return (
    <View style={[styles.phaseSection, phaseStyle]}>
      <View style={styles.phaseHeader}>
        <Text style={[styles.phaseTitle, titleStyle]}>{title}</Text>
        <Text style={styles.phaseSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.phaseActions}>
        {actions.map((action, i) => (
          <View key={i} style={styles.actionItem}>
            <Text style={styles.actionBullet}>▶</Text>
            <Text style={styles.actionText}>{action}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

export function ActionManualDocument({
  data,
}: {
  data: ActionManualData
}) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>
              非常時初動対応マニュアル
            </Text>
            <Text style={styles.headerSub}>
              発災直後の行動指針・緊急連絡網（現場掲示用）
            </Text>
          </View>
          <Text style={styles.headerCompany}>
            {data.companyName}
          </Text>
        </View>

        <View style={styles.content}>
          {/* フェーズ 1: 発災直後 0〜10 分 */}
          <PhaseBlock
            title="【発災直後 0〜10 分】"
            subtitle="人命の安全確保と初動対応を最優先"
            actions={data.phases.immediate}
            phaseStyle={styles.phaseImmediate}
            titleStyle={styles.phaseImmediateTitle}
          />

          {/* フェーズ 2: 当日 〜24 時間 */}
          <PhaseBlock
            title="【当日 〜24 時間】"
            subtitle="被害把握と事業継続体制の立ち上げ"
            actions={data.phases.sameDay}
            phaseStyle={styles.phaseSameDay}
            titleStyle={styles.phaseSameDayTitle}
          />

          {/* フェーズ 3: 翌日以降 */}
          <PhaseBlock
            title="【翌日以降】"
            subtitle="事業再開に向けた対応と見直し"
            actions={data.phases.nextDayPlus}
            phaseStyle={styles.phaseNextDay}
            titleStyle={styles.phaseNextDayTitle}
          />

          {/* 緊急連絡網 */}
          <View style={styles.contactSection}>
            <Text style={styles.contactTitle}>緊急連絡網</Text>
            <View style={styles.contactTable}>
              {data.emergencyContacts.map((contact, i) => (
                <View key={i} style={styles.contactRow}>
                  <Text style={styles.contactRole}>{contact.role}</Text>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  <Text style={styles.contactPhone}>
                    {contact.phone}
                  </Text>
                  {contact.email && (
                    <Text style={styles.contactEmail}>
                      {contact.email}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* フッター */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {data.companyName}｜策定日：{data.createdAt}
          </Text>
          <Text style={styles.footerText}>
            初動対応マニュアル / A4 横・1 枚
          </Text>
        </View>
      </Page>
    </Document>
  )
}
