'use client'

import { useMemo, useState } from 'react'
import {
  computeScenarioKosten, berekenScenarioOmzetEnBetaalprovider, SCENARIO_PRIJZEN, SCENARIO_TEAM_PRIJS,
  type ScenarioBillingSplit, type TierVerdeling, type Betaalprovider, type TeamScenario, type TeamBillingSplit, type Inputs,
} from '@/lib/kostenTarieven'
import { cardStyle, cardHeadStyle, dotStyle, statLabel, statValue, headlineValueStyle, statCellStyle, fmtEUR } from './abacusShared'

const MAANDEN = 12

type Groeicurve = 'lineair' | 'versnellend'
type VerloopMaand = { maand: number; users: number; omzet: number; kosten: number; winst: number }

// Het scenario op de Business case-tab is het EINDPUNT na maand 12: maand 12
// levert exact de scenariocijfers op (controleerbaar tegen het blok erboven).
// Solo-users en teamklanten groeien met dezelfde factor mee, zoals de variant
// "Team schaalt mee" bij de doelwinst. Solo wordt afgerond op hele users,
// teamklanten blijven fractioneel (verwachtingswaarde), zodat de lijn bij een
// klein aantal teamklanten niet in sprongen loopt. Kosten zijn één totaal
// (AI/infra incl. vaste kosten en staffels, plus betaalprovider).
function berekenVerloop(
  curve: Groeicurve, soloEind: number, verdeling: TierVerdeling, billingSplit: ScenarioBillingSplit,
  betaalprovider: Betaalprovider, team: TeamScenario, teamBillingSplit: TeamBillingSplit, inputs: Inputs
): VerloopMaand[] {
  return Array.from({ length: MAANDEN }, (_, i) => {
    const maand = i + 1
    const lineair = maand / MAANDEN
    const factor = curve === 'lineair' ? lineair : lineair * lineair
    const teamM: TeamScenario = { aantalKlanten: team.aantalKlanten * factor, gemiddeldeLeden: team.gemiddeldeLeden }
    const r = berekenScenarioOmzetEnBetaalprovider(
      SCENARIO_PRIJZEN, billingSplit, verdeling, betaalprovider, Math.round(soloEind * factor), SCENARIO_TEAM_PRIJS, teamM, teamBillingSplit
    )
    const kosten = computeScenarioKosten(inputs, r.basicN, r.proN, r.teamLeden).totaal / inputs.fxRate + r.betaalproviderKosten
    return { maand, users: Math.round(r.basicN + r.proN + r.teamLeden), omzet: r.omzetTotaal, kosten, winst: r.omzetTotaal - kosten }
  })
}

function niceStep(range: number, ticks: number): number {
  const raw = range / ticks
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag
}

const W = 900
const H = 300
const M = { l: 64, r: 12, t: 12, b: 28 }
const KLEUR_OMZET = '#f59e0b'
const KLEUR_KOSTEN = '#64748b'
const KLEUR_WINST = '#f1f5f9'

function Grafiek({ data, hover, setHover }: { data: VerloopMaand[]; hover: number; setHover: (i: number) => void }) {
  const { ticks, yMin, yMax } = useMemo(() => {
    const hi = Math.max(...data.map(d => Math.max(d.omzet, d.kosten, d.winst)), 1)
    const lo = Math.min(0, ...data.map(d => d.winst))
    const step = niceStep(hi - lo, 4)
    const min = Math.floor(lo / step) * step
    const max = Math.ceil(hi / step) * step
    const t: number[] = []
    for (let v = min; v <= max + step / 2; v += step) t.push(v)
    return { ticks: t, yMin: min, yMax: max }
  }, [data])

  const plotW = W - M.l - M.r
  const plotH = H - M.t - M.b
  const groep = plotW / MAANDEN
  const bar = groep * 0.3
  const y = (v: number) => M.t + plotH - ((v - yMin) / (yMax - yMin)) * plotH
  const cx = (i: number) => M.l + groep * i + groep / 2
  const lijn = data.map((d, i) => `${cx(i)},${y(d.winst)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Omzet, kosten en winst per maand, eerste 12 maanden" style={{ display: 'block' }}>
      {ticks.map(t => (
        <g key={t}>
          <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? '#475569' : 'rgba(255,255,255,0.06)'} strokeWidth={1} />
          <text x={M.l - 8} y={y(t) + 4} textAnchor="end" fontSize={12} fill="#6b7280">{fmtEUR(t)}</text>
        </g>
      ))}
      {data.map((d, i) => (
        <g key={d.maand}>
          {hover === i && <rect x={M.l + groep * i} y={M.t} width={groep} height={plotH} fill="rgba(255,255,255,0.05)" />}
          <rect x={cx(i) - bar - 1} y={Math.min(y(d.omzet), y(0))} width={bar} height={Math.abs(y(d.omzet) - y(0))} fill={KLEUR_OMZET} rx={2} />
          <rect x={cx(i) + 1} y={Math.min(y(d.kosten), y(0))} width={bar} height={Math.abs(y(d.kosten) - y(0))} fill={KLEUR_KOSTEN} rx={2} />
          <text x={cx(i)} y={H - 8} textAnchor="middle" fontSize={12} fill={hover === i ? '#f1f5f9' : '#6b7280'}>{d.maand}</text>
          <rect
            x={M.l + groep * i} y={M.t} width={groep} height={plotH} fill="transparent" style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}
          />
        </g>
      ))}
      <polyline points={lijn} fill="none" stroke={KLEUR_WINST} strokeWidth={2} strokeLinejoin="round" pointerEvents="none" />
      {data.map((d, i) => (
        <circle key={d.maand} cx={cx(i)} cy={y(d.winst)} r={hover === i ? 5 : 3} fill={KLEUR_WINST} pointerEvents="none" />
      ))}
    </svg>
  )
}

function LegendItem({ kleur, label, lijn = false }: { kleur: string; label: string; lijn?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8' }}>
      <span style={{ width: lijn ? 14 : 10, height: lijn ? 2 : 10, background: kleur, borderRadius: lijn ? 0 : 2, display: 'inline-block' }} />
      {label}
    </span>
  )
}

const segBtn = (actief: boolean): React.CSSProperties => ({
  background: actief ? 'rgba(245,158,11,0.12)' : 'transparent',
  border: actief ? '1.5px solid rgba(245,158,11,0.6)' : '1.5px solid #2d3a4f',
  color: actief ? '#f1f5f9' : '#94a3b8', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer',
})

export default function VerloopKaart({ nGebruikers, verdeling, billingSplit, betaalprovider, team, teamBillingSplit, inputs }: {
  nGebruikers: number; verdeling: TierVerdeling; billingSplit: ScenarioBillingSplit; betaalprovider: Betaalprovider
  team: TeamScenario; teamBillingSplit: TeamBillingSplit; inputs: Inputs
}) {
  const [curve, setCurve] = useState<Groeicurve>('lineair')
  const [hover, setHover] = useState(MAANDEN - 1)

  const data = useMemo(
    () => berekenVerloop(curve, nGebruikers, verdeling, billingSplit, betaalprovider, team, teamBillingSplit, inputs),
    [curve, nGebruikers, verdeling, billingSplit, betaalprovider, team, teamBillingSplit, inputs]
  )

  const cumulatief = data.reduce((s, d) => s + d.winst, 0)
  const laatsteNegatief = data.reduce((acc, d, i) => (d.winst < 0 ? i : acc), -1)
  const breakEven = laatsteNegatief === MAANDEN - 1 ? 'Niet binnen 12 mnd' : `Maand ${laatsteNegatief + 2}`
  const h = data[hover] ?? data[MAANDEN - 1]

  return (
    <div style={cardStyle}>
      <div style={cardHeadStyle}><span style={dotStyle} />Verloop eerste 12 maanden</div>
      <div style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 14 }}>
        <div>Het scenario hierboven is het eindpunt: na maand 12 zit je op die aantallen. Teamklanten groeien proportioneel mee.</div>
        <div>Kosten zijn één totaal: AI, infra, vaste kosten en betaalprovider.</div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <span style={statLabel}>Groeicurve</span>
        <button type="button" style={segBtn(curve === 'lineair')} onClick={() => setCurve('lineair')}>Lineair</button>
        <button type="button" style={segBtn(curve === 'versnellend')} onClick={() => setCurve('versnellend')}>Versnellend</button>
      </div>

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 6 }}>
        <LegendItem kleur={KLEUR_OMZET} label="Omzet" />
        <LegendItem kleur={KLEUR_KOSTEN} label="Kosten" />
        <LegendItem kleur={KLEUR_WINST} label="Winst" lijn />
      </div>
      <div style={{ fontSize: 13, color: '#94a3b8', minHeight: 20, marginBottom: 6, fontVariantNumeric: 'tabular-nums' }}>
        Maand {h.maand} &middot; {h.users.toLocaleString('nl-NL')} users &middot; omzet {fmtEUR(h.omzet)} &middot; kosten {fmtEUR(h.kosten)} &middot; winst {fmtEUR(h.winst)}
      </div>

      <Grafiek data={data} hover={hover} setHover={setHover} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginTop: 14, maxWidth: 520 }}>
        <div style={statCellStyle}><div style={statLabel}>Winst maand 12</div><div style={headlineValueStyle}>{fmtEUR(data[MAANDEN - 1].winst)}</div></div>
        <div style={statCellStyle}><div style={statLabel}>Cumulatief 12 mnd</div><div style={statValue}>{fmtEUR(cumulatief)}</div></div>
        <div style={statCellStyle}><div style={statLabel}>Break-even</div><div style={{ ...statValue, fontSize: breakEven.length > 8 ? 15 : 22 }}>{breakEven}</div></div>
      </div>

      <div style={{ overflowX: 'auto', marginTop: 16 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr>
              <th style={{ ...statLabel, textAlign: 'left', padding: '6px 8px' }} />
              {data.map(d => <th key={d.maand} style={{ ...statLabel, textAlign: 'right', padding: '6px 8px' }}>M{d.maand}</th>)}
            </tr>
          </thead>
          <tbody>
            {([['Users', (d: VerloopMaand) => d.users.toLocaleString('nl-NL')], ['Omzet', (d: VerloopMaand) => fmtEUR(d.omzet)], ['Kosten', (d: VerloopMaand) => fmtEUR(d.kosten)], ['Winst', (d: VerloopMaand) => fmtEUR(d.winst)]] as const).map(([naam, f]) => (
              <tr key={naam} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ ...statLabel, padding: '6px 8px', whiteSpace: 'nowrap' }}>{naam}</td>
                {data.map(d => (
                  <td key={d.maand} style={{ textAlign: 'right', padding: '6px 8px', color: naam === 'Winst' && d.winst < 0 ? '#ef4444' : '#cbd5e1', whiteSpace: 'nowrap' }}>{f(d)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
