// Twee grafieken onder elkaar, zonder client-JavaScript (pure SVG):
// 1. Staafdiagram: aanmeldingen en afmeldingen per maand, naast elkaar.
// 2. Lijn: het totaal aantal bevestigde abonnees aan het einde van elke maand.
// Bewust twee grafieken i.p.v. een dubbele as: het totaal groeit veel hoger dan de maandcijfers en
// zou de staven plat drukken. Bij elke staaf en elk punt staat het getal. Lettergrootte 12, zoals
// de admin-norm vraagt.

export interface MaandPunt {
  label: string
  aanmeldingen: number
  afmeldingen: number
  totaal: number
}

const W = 720
const PAD = { left: 36, right: 12, top: 22, bottom: 30 }
const AMBER = '#f59e0b'
const GRIJS = '#6b7280'
const WIT = '#f1f5f9'
const LIJN = '#374151'

// Hoogste waarde omhoog afronden op een mooi getal, zodat de as in hele getallen verdeeld kan worden.
function niceMax(max: number): number {
  // Kleinste mooie stapgrootte (1, 2, 5, 10, 20, 50, ...) waarvoor vier stappen de hoogste waarde
  // bevatten: de as heeft vier vakken en elk gridlijngetal is zo een heel getal.
  for (let macht = 1; ; macht *= 10) {
    for (const m of [1, 2, 5]) {
      const stap = m * macht
      if (stap * 4 >= max) return stap * 4
    }
  }
}

function Raster({ max, h }: { max: number; h: number }) {
  const innerH = h - PAD.top - PAD.bottom
  const ticks = [0, 1, 2, 3, 4].map(i => (max / 4) * i)
  return (
    <>
      {ticks.map(t => {
        const y = PAD.top + innerH - (t / max) * innerH
        return (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke={LIJN} strokeWidth={1} />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize={12} fill={GRIJS}>{Number.isInteger(t) ? t : t.toFixed(1)}</text>
          </g>
        )
      })}
    </>
  )
}

function Legenda({ items }: { items: { kleur: string; tekst: string }[] }) {
  return (
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 8 }}>
      {items.map(i => (
        <span key={i.tekst} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 2, color: '#9ca3af' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: i.kleur, display: 'inline-block' }} />
          {i.tekst}
        </span>
      ))}
    </div>
  )
}

export default function MaandGrafieken({ maanden }: { maanden: MaandPunt[] }) {
  const n = maanden.length
  const innerW = W - PAD.left - PAD.right
  const stap = innerW / n
  const xMidden = (i: number) => PAD.left + stap * i + stap / 2

  // ---- staven
  const hBar = 230
  const innerHBar = hBar - PAD.top - PAD.bottom
  const maxBar = niceMax(Math.max(1, ...maanden.flatMap(m => [m.aanmeldingen, m.afmeldingen])))
  const yBar = (v: number) => PAD.top + innerHBar - (v / maxBar) * innerHBar
  const groep = Math.min(stap * 0.76, 44)
  const staafB = groep / 2 - 1

  // ---- lijn
  const hLijn = 200
  const innerHLijn = hLijn - PAD.top - PAD.bottom
  const maxLijn = niceMax(Math.max(1, ...maanden.map(m => m.totaal)))
  const yLijn = (v: number) => PAD.top + innerHLijn - (v / maxLijn) * innerHLijn
  const punten = maanden.map((m, i) => `${xMidden(i)},${yLijn(m.totaal)}`).join(' ')

  const xLabels = (h: number) =>
    maanden.map((m, i) => (
      <text key={m.label + i} x={xMidden(i)} y={h - 8} textAnchor="middle" fontSize={12} fill={GRIJS}>{m.label}</text>
    ))

  return (
    <div>
      <p style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 2, color: '#6b7280', marginBottom: 8 }}>AANMELDINGEN EN AFMELDINGEN PER MAAND</p>
      <Legenda items={[{ kleur: AMBER, tekst: 'AANMELDINGEN' }, { kleur: GRIJS, tekst: 'AFMELDINGEN' }]} />
      <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${hBar}`} width="100%" role="img" aria-label="Staafdiagram van aanmeldingen en afmeldingen per maand" style={{ display: 'block', minWidth: 600 }}>
        <Raster max={maxBar} h={hBar} />
        {maanden.map((m, i) => {
          const x0 = xMidden(i) - groep / 2
          return (
            <g key={m.label + i}>
              <rect x={x0} y={yBar(m.aanmeldingen)} width={staafB} height={Math.max(0, PAD.top + innerHBar - yBar(m.aanmeldingen))} fill={AMBER} rx={2} />
              <rect x={x0 + staafB + 2} y={yBar(m.afmeldingen)} width={staafB} height={Math.max(0, PAD.top + innerHBar - yBar(m.afmeldingen))} fill={GRIJS} rx={2} />
              {m.aanmeldingen > 0 && <text x={x0 + staafB / 2} y={yBar(m.aanmeldingen) - 5} textAnchor="middle" fontSize={12} fill={WIT}>{m.aanmeldingen}</text>}
              {m.afmeldingen > 0 && <text x={x0 + staafB + 2 + staafB / 2} y={yBar(m.afmeldingen) - 5} textAnchor="middle" fontSize={12} fill="#9ca3af">{m.afmeldingen}</text>}
            </g>
          )
        })}
        {xLabels(hBar)}
      </svg>
      </div>

      <p style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 2, color: '#6b7280', margin: '28px 0 8px' }}>TOTAAL BEVESTIGDE ABONNEES, EINDE VAN DE MAAND</p>
      <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${hLijn}`} width="100%" role="img" aria-label="Lijngrafiek van het totaal aantal abonnees per maand" style={{ display: 'block', minWidth: 600 }}>
        <Raster max={maxLijn} h={hLijn} />
        <polyline points={punten} fill="none" stroke={WIT} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {maanden.map((m, i) => (
          <g key={m.label + i}>
            <circle cx={xMidden(i)} cy={yLijn(m.totaal)} r={4} fill={AMBER} stroke="#1f2937" strokeWidth={2} />
            <text x={xMidden(i)} y={yLijn(m.totaal) - 10} textAnchor="middle" fontSize={12} fill={WIT}>{m.totaal}</text>
          </g>
        ))}
        {xLabels(hLijn)}
      </svg>
      </div>
    </div>
  )
}
