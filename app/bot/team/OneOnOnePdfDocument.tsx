// @ts-nocheck
import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

interface OneOnOnePdfProps {
  naam: string
  datum: string
  aandachtspunt: string | null
  agenda: string
  notitie: string | null
  actie: string | null
  actieStatus: 'ja' | 'nee' | 'skip' | null
  mindsetScore: number | null
  systeemScore: number | null
  actieScore: number | null
}

const C = {
  bg: '#111827', cream: '#f1f5f9', orange: '#f59e0b', subtle: '#1f2937',
  white: '#ffffff', dark: '#3d3935', mid: '#8c8480', line: '#ddd8d0',
}

const s = StyleSheet.create({
  cover: { backgroundColor: C.bg, padding: '40 44', fontFamily: 'Helvetica' },
  brandRow: { flexDirection: 'row', marginBottom: 32 },
  brandArno: { color: C.cream, fontSize: 14, fontFamily: 'Helvetica-Bold', letterSpacing: 3 },
  brandBot: { color: C.orange, fontSize: 14, fontFamily: 'Helvetica-Bold', letterSpacing: 3 },
  label: { color: C.orange, fontSize: 8, letterSpacing: 3, marginBottom: 8 },
  title: { fontSize: 30, color: C.cream, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  sub: { color: C.cream, fontSize: 9, opacity: 0.4, marginBottom: 24 },
  divider: { height: 1, backgroundColor: C.subtle, marginBottom: 20 },
  scoresRow: { flexDirection: 'row', gap: 16 },
  scoreCell: { flex: 1, backgroundColor: C.subtle, padding: '12 14', borderRadius: 2 },
  scoreLabel: { color: C.orange, fontSize: 7, letterSpacing: 2, marginBottom: 6 },
  scoreValue: { color: C.cream, fontSize: 22, fontFamily: 'Helvetica-Bold' },
  body: { backgroundColor: C.white, padding: '36 44', fontFamily: 'Helvetica' },
  groupLabel: { fontSize: 8, color: C.orange, fontFamily: 'Helvetica-Bold', letterSpacing: 2, marginBottom: 8, marginTop: 20 },
  groupLabelFirst: { fontSize: 8, color: C.orange, fontFamily: 'Helvetica-Bold', letterSpacing: 2, marginBottom: 8 },
  paragraph: { fontSize: 9.5, color: C.dark, lineHeight: 1.7, marginBottom: 4 },
  notitieBox: { marginTop: 24, borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 16 },
  notitieLabel: { fontSize: 8, color: C.mid, letterSpacing: 2, marginBottom: 6 },
  notitieText: { fontSize: 9.5, color: C.dark, lineHeight: 1.7, fontFamily: 'Helvetica-Oblique' },
  actieStatus: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', marginTop: 4, marginBottom: 4 },
  footer: { position: 'absolute', bottom: 20, left: 44, right: 44, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { color: C.mid, fontSize: 6.5, letterSpacing: 1, opacity: 0.6 },
})

interface AgendaSection { heading: string; lines: string[] }

function parseAgenda(agenda: string): AgendaSection[] {
  const sections: AgendaSection[] = []
  let current: AgendaSection | null = null
  for (const rawLine of agenda.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    const isHeading = line.length < 60 && line === line.toUpperCase() && /[A-Z]/.test(line)
    if (isHeading) {
      current = { heading: line, lines: [] }
      sections.push(current)
    } else if (current) {
      current.lines.push(line)
    } else {
      current = { heading: '', lines: [line] }
      sections.push(current)
    }
  }
  return sections
}

function formatDatum(datum: string) {
  return new Date(datum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}

const ACTIE_STATUS_LABEL: Record<string, string> = { ja: 'GEDAAN', nee: 'NIET GEDAAN', skip: 'OVERGESLAGEN' }
const ACTIE_STATUS_COLOR: Record<string, string> = { ja: '#2e7d5b', nee: '#b3401f', skip: C.mid }

export function OneOnOnePdfDocument({ naam, datum, aandachtspunt, agenda, notitie, actie, actieStatus, mindsetScore, systeemScore, actieScore }: OneOnOnePdfProps) {
  const sections = parseAgenda(agenda)
  const scores = [
    { label: 'MINDSET', value: mindsetScore },
    { label: 'SYSTEEM', value: systeemScore },
    { label: 'ACTIE', value: actieScore },
  ]

  return (
    <Document title={`1:1 Agenda - ${naam}`} author="ArnoBot" subject="1:1 gesprek">
      <Page size="A4">
        <View style={s.cover}>
          <View style={s.brandRow}>
            <Text style={s.brandArno}>ARNO</Text>
            <Text style={s.brandBot}>BOT</Text>
          </View>
          <Text style={s.label}>1:1 AGENDA</Text>
          <Text style={s.title}>{naam}</Text>
          <Text style={s.sub}>{formatDatum(datum)}</Text>
          <View style={s.divider} />
          {scores.some(sc => sc.value !== null) && (
            <View style={s.scoresRow}>
              {scores.map(sc => (
                <View key={sc.label} style={s.scoreCell}>
                  <Text style={s.scoreLabel}>{sc.label}</Text>
                  <Text style={s.scoreValue}>{sc.value ?? '-'}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={s.body}>
          {aandachtspunt && (
            <View>
              <Text style={s.groupLabelFirst}>AANDACHTSPUNT</Text>
              <Text style={s.paragraph}>{aandachtspunt}</Text>
            </View>
          )}

          {actie && (
            <View>
              <Text style={!aandachtspunt ? s.groupLabelFirst : s.groupLabel}>ACTIE</Text>
              <Text style={s.paragraph}>{actie}</Text>
              {actieStatus && (
                <Text style={[s.actieStatus, { color: ACTIE_STATUS_COLOR[actieStatus] }]}>{ACTIE_STATUS_LABEL[actieStatus]}</Text>
              )}
            </View>
          )}

          {sections.map((sec, i) => (
            <View key={i}>
              {sec.heading ? <Text style={i === 0 && !aandachtspunt && !actie ? s.groupLabelFirst : s.groupLabel}>{sec.heading}</Text> : null}
              {sec.lines.map((line, j) => (
                <Text key={j} style={s.paragraph}>{line}</Text>
              ))}
            </View>
          ))}

          {notitie && (
            <View style={s.notitieBox}>
              <Text style={s.notitieLabel}>NOTITIE VAN DE MANAGER</Text>
              <Text style={s.notitieText}>{notitie}</Text>
            </View>
          )}
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>ARNOBOT | 1:1 AGENDA</Text>
          <Text style={s.footerText}>{naam}</Text>
        </View>
      </Page>
    </Document>
  )
}
