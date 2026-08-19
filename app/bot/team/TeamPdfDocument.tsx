// @ts-nocheck
import React from 'react'
import { Document, Page, Text, View, StyleSheet, Svg, Path, Circle, Line, Defs, LinearGradient, Stop } from '@react-pdf/renderer'

interface TeamPdfMember {
  naam: string
  msa: number | null
  sessies: number
  analyses: number
  laatsteActiviteit: string | null
}

interface TeamScorePoint {
  mindset_score: number | null
  systeem_score: number | null
  actie_score: number | null
  created_at: string
}

interface TeamPdfProps {
  teamNaam: string
  datum: string
  teamMsa: number | null
  mindsetScore: number | null
  systeemScore: number | null
  actieScore: number | null
  scoreGeschiedenis: TeamScorePoint[]
  members: TeamPdfMember[]
  spotlightText: string | null
  spotlightDatum: string | null
}

// Zelfde kleuren/schaal als de on-screen TEAMSCORES-grafiek (ProgressieChart.tsx/MiniChart),
// zodat het rapport er precies zo uitziet als wat de manager al op het scherm kent: drie losse
// kaarten, niet één samengevoegde grafiek.
const CHART_SERIES: { key: keyof Omit<TeamScorePoint, 'created_at'>; color: string; label: string }[] = [
  { key: 'mindset_score', color: '#f59e0b', label: 'MINDSET' },
  { key: 'systeem_score', color: '#60a5fa', label: 'SYSTEEM' },
  { key: 'actie_score', color: '#34d399', label: 'ACTIE' },
]

const C = {
  bg: '#111827', cream: '#f1f5f9', orange: '#f59e0b', subtle: '#1f2937',
  white: '#ffffff', dark: '#3d3935', mid: '#8c8480', line: '#ddd8d0', gridDark: '#374151',
}

const s = StyleSheet.create({
  cover: { backgroundColor: C.bg, padding: '30 44', fontFamily: 'Helvetica' },
  brandRow: { flexDirection: 'row', marginBottom: 22 },
  brandArno: { color: C.cream, fontSize: 14, fontFamily: 'Helvetica-Bold', letterSpacing: 3 },
  brandBot: { color: C.orange, fontSize: 14, fontFamily: 'Helvetica-Bold', letterSpacing: 3 },
  label: { color: C.orange, fontSize: 8, letterSpacing: 3, marginBottom: 8 },
  title: { fontSize: 26, color: C.cream, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  sub: { color: C.cream, fontSize: 9, opacity: 0.4, marginBottom: 16 },
  divider: { height: 1, backgroundColor: C.subtle, marginBottom: 14 },
  scoresRow: { flexDirection: 'row', gap: 12 },
  scoreCell: { flex: 1, backgroundColor: C.subtle, padding: '9 12', borderRadius: 2 },
  scoreLabel: { color: C.orange, fontSize: 7, letterSpacing: 2, marginBottom: 6 },
  scoreValue: { color: C.cream, fontSize: 20, fontFamily: 'Helvetica-Bold' },
  body: { backgroundColor: C.white, padding: '28 44 8 44', fontFamily: 'Helvetica', minHeight: '100%' },
  groupLabel: { fontSize: 8, color: C.orange, fontFamily: 'Helvetica-Bold', letterSpacing: 2, marginBottom: 7, marginTop: 14 },
  groupLabelFirst: { fontSize: 8, color: C.orange, fontFamily: 'Helvetica-Bold', letterSpacing: 2, marginBottom: 7 },
  paragraph: { fontSize: 9.5, color: C.dark, lineHeight: 1.6, marginBottom: 3 },
  table: { marginTop: 2 },
  tableHeadRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.line, paddingBottom: 5, marginBottom: 4 },
  tableRow: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: C.line },
  tableHeadCell: { fontSize: 7, color: C.mid, letterSpacing: 1.5, fontFamily: 'Helvetica-Bold' },
  tableCell: { fontSize: 9.5, color: C.dark },
  colNaam: { flex: 2 },
  colGetal: { flex: 1, textAlign: 'right' },
  chartRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  chartCard: { flex: 1, backgroundColor: C.subtle, borderRadius: 4, padding: '10 8 6 8' },
  chartCardHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 },
  chartCardLabel: { fontSize: 7, color: C.cream, letterSpacing: 2, fontFamily: 'Helvetica-Bold' },
  chartCardValue: { fontSize: 17, fontFamily: 'Helvetica-Bold' },
  footer: { position: 'absolute', bottom: 24, left: 44, right: 44, flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 0.5, borderTopColor: C.line },
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

function maandNaam(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', { month: 'short' }).toUpperCase().replace('.', '')
}

function curvePath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], c = pts[i], mx = (p.x + c.x) / 2
    d += ` C ${mx} ${p.y} ${mx} ${c.y} ${c.x} ${c.y}`
  }
  return d
}

// Zelfde geometrie-aanpak als MiniChart in ProgressieChart.tsx, maar op maat van de
// daadwerkelijk beschikbare breedte in dit PDF-rapport: bodybreedte 507pt, drie kaarten met
// 10pt gap ertussen en 8pt padding aan elke kant = (507-20)/3-16 ≈ 146pt beschikbaar. MC_W=158
// (1-op-1 overgenomen van de webversie, die op een bredere kaart staat) paste daar niet in en
// liet de grafiek over de kaartrand heen lopen. Nu met marge eronder.
const MC_W = 144, MC_H = 84, MC_PL = 16, MC_PR = 4, MC_PT = 6, MC_PB = 18
const MC_IW = MC_W - MC_PL - MC_PR, MC_IH = MC_H - MC_PT - MC_PB

function mcX(i: number, n: number): number {
  return n <= 1 ? MC_PL + MC_IW / 2 : MC_PL + (i / (n - 1)) * MC_IW
}
function mcY(v: number): number {
  return MC_PT + (1 - (v - 1) / 4) * MC_IH
}

function MiniChart({ points, color, gradId }: { points: { month: string; value: number }[]; color: string; gradId: string }) {
  const n = points.length
  if (n === 0) return <Text style={{ fontSize: 8, color: C.gridDark }}>Geen data</Text>

  const pts = points.map((p, i) => ({ x: mcX(i, n), y: mcY(p.value) }))
  const line = curvePath(pts)
  const area = line ? line + ` L ${pts[n - 1].x} ${MC_PT + MC_IH} L ${pts[0].x} ${MC_PT + MC_IH} Z` : ''

  return (
    <View>
      <Svg width={MC_W} height={MC_H} viewBox={`0 0 ${MC_W} ${MC_H}`}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {[1, 2, 3, 4, 5].map(v => (
          <Line
            key={v}
            x1={MC_PL} y1={mcY(v)} x2={MC_W - MC_PR} y2={mcY(v)}
            stroke={C.gridDark} strokeWidth={0.5}
            strokeDasharray={v === 1 || v === 5 ? undefined : '2 2'}
          />
        ))}
        {[1, 2, 3, 4, 5].map(v => (
          <Text key={v} x={MC_PL - 3} y={mcY(v) + 2.5} fill={C.gridDark} fontSize={6} textAnchor="end">{v}</Text>
        ))}
        {area && <Path d={area} fill={`url(#${gradId})`} />}
        {line && <Path d={line} stroke={color} strokeWidth={1.6} fill="none" />}
        {pts.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={i === n - 1 ? 2.6 : 2} fill={C.subtle} stroke={color} strokeWidth={1.3} />
        ))}
        {points.map((p, i) => (
          <Text
            key={i}
            x={mcX(i, n)}
            y={MC_H - 4}
            fill={C.mid}
            fontSize={6}
            // Rand-labels middenuitgelijnd laten overschrijden ze de viewBox (bijv. "JUN"
            // op het laatste punt, dat vlak bij de rechterrand ligt). Eerste/laatste label
            // groeit daarom naar binnen toe i.p.v. gecentreerd, middelste labels blijven
            // gecentreerd.
            textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
          >{p.month}</Text>
        ))}
      </Svg>
    </View>
  )
}

export function TeamPdfDocument({ teamNaam, datum, teamMsa, mindsetScore, systeemScore, actieScore, scoreGeschiedenis, members, spotlightText, spotlightDatum }: TeamPdfProps) {
  const scores = [
    { label: 'TEAM MSA', value: teamMsa },
    { label: 'MINDSET', value: mindsetScore },
    { label: 'SYSTEEM', value: systeemScore },
    { label: 'ACTIE', value: actieScore },
  ]
  const sections = spotlightText ? parseTekst(spotlightText) : []

  const geschiedenis = (scoreGeschiedenis ?? []).filter(h =>
    h.mindset_score != null || h.systeem_score != null || h.actie_score != null
  )

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

        {/* Pagina 1: grafieken + teamledentabel. Eigen (fixed) footer, zodat pagina 1 altijd
            netjes afsluit, ongeacht hoeveel ruimte de tabel inneemt. */}
        <View style={s.body}>
          {geschiedenis.length >= 2 && (
            <View>
              <Text style={s.groupLabelFirst}>TEAMSCORES OVER TIJD</Text>
              <View style={s.chartRow}>
                {CHART_SERIES.map(sr => {
                  const points = geschiedenis
                    .filter(h => h[sr.key] != null)
                    .map(h => ({ month: maandNaam(h.created_at), value: h[sr.key] as number }))
                  const current = points.length > 0 ? points[points.length - 1].value : null
                  return (
                    <View key={sr.key} style={s.chartCard}>
                      <View style={s.chartCardHeadRow}>
                        <Text style={s.chartCardLabel}>{sr.label}</Text>
                        {current != null && <Text style={[s.chartCardValue, { color: sr.color }]}>{current.toFixed(1)}</Text>}
                      </View>
                      <MiniChart points={points} color={sr.color} gradId={`grad-${sr.key}`} />
                    </View>
                  )
                })}
              </View>
            </View>
          )}

          <Text style={geschiedenis.length >= 2 ? s.groupLabel : s.groupLabelFirst}>TEAMLEDEN ({members.length})</Text>
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
        </View>

        {/* Pagina 2 (bewust een nieuwe pagina, niet laten afhangen van of alles toevallig past):
            de volledige analyse. break dwingt dit blok op een verse pagina af. */}
        {spotlightText && (
          <View style={s.body} break>
            <Text style={s.groupLabelFirst}>TEAM SPOTLIGHT{spotlightDatum ? ` (${formatDatum(spotlightDatum)})` : ''}</Text>
            {sections.map((sec, i) => (
              <View key={i}>
                {sec.heading ? <Text style={i === 0 ? s.groupLabelFirst : s.groupLabel}>{sec.heading}</Text> : null}
                {sec.lines.map((line, j) => (
                  <Text key={j} style={s.paragraph}>{line}</Text>
                ))}
              </View>
            ))}
          </View>
        )}

        <View style={s.footer} fixed>
          <Text style={s.footerText}>ARNOBOT | TEAM-RAPPORT</Text>
          <Text style={s.footerText}>{teamNaam}</Text>
        </View>
      </Page>
    </Document>
  )
}
