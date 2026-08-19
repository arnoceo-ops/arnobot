// @ts-nocheck
import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

interface TeamPdfMember {
  naam: string
  msa: number | null
  sessies: number
  analyses: number
  laatsteActiviteit: string | null
}

interface TeamPdfProps {
  teamNaam: string
  datum: string
  teamMsa: number | null
  mindsetScore: number | null
  systeemScore: number | null
  actieScore: number | null
  members: TeamPdfMember[]
  spotlightText: string | null
  spotlightDatum: string | null
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
  scoresRow: { flexDirection: 'row', gap: 12 },
  scoreCell: { flex: 1, backgroundColor: C.subtle, padding: '12 12', borderRadius: 2 },
  scoreLabel: { color: C.orange, fontSize: 7, letterSpacing: 2, marginBottom: 6 },
  scoreValue: { color: C.cream, fontSize: 20, fontFamily: 'Helvetica-Bold' },
  body: { backgroundColor: C.white, padding: '36 44', fontFamily: 'Helvetica' },
  groupLabel: { fontSize: 8, color: C.orange, fontFamily: 'Helvetica-Bold', letterSpacing: 2, marginBottom: 8, marginTop: 20 },
  groupLabelFirst: { fontSize: 8, color: C.orange, fontFamily: 'Helvetica-Bold', letterSpacing: 2, marginBottom: 8 },
  paragraph: { fontSize: 9.5, color: C.dark, lineHeight: 1.7, marginBottom: 4 },
  table: { marginTop: 4 },
  tableHeadRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.line, paddingBottom: 6, marginBottom: 6 },
  tableRow: { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: C.line },
  tableHeadCell: { fontSize: 7, color: C.mid, letterSpacing: 1.5, fontFamily: 'Helvetica-Bold' },
  tableCell: { fontSize: 9.5, color: C.dark },
  colNaam: { flex: 2 },
  colGetal: { flex: 1, textAlign: 'right' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 28, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: C.line },
  footerText: { color: C.mid, fontSize: 6.5, letterSpacing: 1, opacity: 0.6 },
})

interface TextSection { heading: string; lines: string[] }

function parseTekst(tekst: string): TextSection[] {
  const sections: TextSection[] = []
  let current: TextSection | null = null
  for (const rawLine of tekst.split('\n')) {
    let line = rawLine.trim()
    if (!line || /^-{2,}$/.test(line)) continue
    const boldOnly = line.match(/^\*\*([^*]+)\*\*$/)
    if (boldOnly) line = boldOnly[1]
    line = line.replace(/\*\*([^*]+)\*\*/g, '$1')
    const isHeading = !!boldOnly || (line.length < 60 && line === line.toUpperCase() && /[A-Z]/.test(line))
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

export function TeamPdfDocument({ teamNaam, datum, teamMsa, mindsetScore, systeemScore, actieScore, members, spotlightText, spotlightDatum }: TeamPdfProps) {
  const scores = [
    { label: 'TEAM MSA', value: teamMsa },
    { label: 'MINDSET', value: mindsetScore },
    { label: 'SYSTEEM', value: systeemScore },
    { label: 'ACTIE', value: actieScore },
  ]
  const sections = spotlightText ? parseTekst(spotlightText) : []

  return (
    <Document title={`Team-rapport - ${teamNaam}`} author="ArnoBot" subject="Team-rapport">
      <Page size="A4">
        <View style={s.cover}>
          <View style={s.brandRow}>
            <Text style={s.brandArno}>ARNO</Text>
            <Text style={s.brandBot}>BOT</Text>
          </View>
          <Text style={s.label}>TEAM-RAPPORT</Text>
          <Text style={s.title}>{teamNaam}</Text>
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
          <Text style={s.groupLabelFirst}>TEAMLEDEN ({members.length})</Text>
          <View style={s.table}>
            <View style={s.tableHeadRow}>
              <Text style={[s.tableHeadCell, s.colNaam]}>NAAM</Text>
              <Text style={[s.tableHeadCell, s.colGetal]}>MSA</Text>
              <Text style={[s.tableHeadCell, s.colGetal]}>GESPR.</Text>
              <Text style={[s.tableHeadCell, s.colGetal]}>ANALYSES</Text>
              <Text style={[s.tableHeadCell, s.colGetal]}>LAATST ACTIEF</Text>
            </View>
            {members.map((m, i) => (
              <View key={i} style={s.tableRow}>
                <Text style={[s.tableCell, s.colNaam]}>{m.naam}</Text>
                <Text style={[s.tableCell, s.colGetal]}>{m.msa ?? '-'}</Text>
                <Text style={[s.tableCell, s.colGetal]}>{m.sessies}</Text>
                <Text style={[s.tableCell, s.colGetal]}>{m.analyses}</Text>
                <Text style={[s.tableCell, s.colGetal]}>{m.laatsteActiviteit ? formatDatum(m.laatsteActiviteit) : '-'}</Text>
              </View>
            ))}
          </View>

          {spotlightText && (
            <>
              <Text style={s.groupLabel}>TEAM SPOTLIGHT{spotlightDatum ? ` (${formatDatum(spotlightDatum)})` : ''}</Text>
              {sections.map((sec, i) => (
                <View key={i}>
                  {sec.heading ? <Text style={s.groupLabel}>{sec.heading}</Text> : null}
                  {sec.lines.map((line, j) => (
                    <Text key={j} style={s.paragraph}>{line}</Text>
                  ))}
                </View>
              ))}
            </>
          )}

          <View style={s.footer}>
            <Text style={s.footerText}>ARNOBOT | TEAM-RAPPORT</Text>
            <Text style={s.footerText}>{teamNaam}</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
