import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { backgroundColor: '#ffffff', padding: 48, fontFamily: 'Helvetica' },
  header: { borderBottomWidth: 3, borderBottomColor: '#f59e0b', paddingBottom: 16, marginBottom: 32 },
  headerLabel: { fontSize: 8, letterSpacing: 3, color: '#f59e0b', marginBottom: 6 },
  headerTitle: { fontSize: 28, fontFamily: 'Helvetica-Bold', color: '#111827' },
  headerDate: { fontSize: 10, color: '#9ca3af', marginTop: 4 },
  session: { marginBottom: 40 },
  sessionHeader: { borderTopWidth: 2, borderTopColor: '#f59e0b', paddingTop: 12, marginBottom: 20 },
  sessionLabel: { fontSize: 8, letterSpacing: 2, color: '#f59e0b', marginBottom: 4 },
  sessionMeta: { fontSize: 8, color: '#6b7280' },
  message: { marginBottom: 20 },
  question: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#111827', marginBottom: 8 },
  answer: { fontSize: 10, color: '#4b5563', lineHeight: 1.7 },
  timestamp: { fontSize: 8, color: '#6b7280', marginTop: 6 },
})

type LogRow = {
  id: string
  created_at: string
  question: string
  answer: string
  ip: string
  session_id: string
}

type Props = {
  sessions: [string, LogRow[]][]
  dateRange: string
}

export function ArnoBotPdfDocument({ sessions, dateRange }: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerLabel}>ARNOBOT · ROYAL DUTCH SALES</Text>
          <Text style={styles.headerTitle}>Gesprekken export</Text>
          <Text style={styles.headerDate}>{dateRange}</Text>
        </View>
        {sessions.map(([sessionId, messages], idx) => (
          <View key={sessionId} style={styles.session} break={idx > 0}>
            <View style={styles.sessionHeader}>
              <Text style={styles.sessionLabel}>
                SESSIE {idx + 1} · {messages[0].ip} · {messages.length} {messages.length === 1 ? 'vraag & antwoord' : 'vragen & antwoorden'}
              </Text>
              <Text style={styles.sessionMeta}>
                {new Date(messages[0].created_at).toLocaleTimeString('nl-NL')} tot {new Date(messages[messages.length - 1].created_at).toLocaleTimeString('nl-NL')}
              </Text>
            </View>
            {messages.map((msg) => (
              <View key={msg.id} style={styles.message}>
                <Text style={styles.question}>{msg.question ?? ''}</Text>
                <Text style={styles.answer}>{
                  (msg.answer ?? '')
                    .replace(/\*\*([^*]+)\*\*/g, '$1')
                    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                }</Text>
              </View>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  )
}
