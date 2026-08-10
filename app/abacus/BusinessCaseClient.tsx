'use client'

import { useMemo, useState } from 'react'
import {
  DEFAULT_INPUTS, DEFAULT_PRIJZEN, computeScenarioKosten, berekenScenarioOmzetEnBetaalprovider, SCENARIO_PRIJZEN, SCENARIO_TEAM_PRIJS,
  type ScenarioBillingSplit, type TierVerdeling, type Betaalprovider, type TeamScenario, type TeamBillingSplit,
} from '@/lib/kostenTarieven'

const FX_EUR_USD = 1.08

function fmtEUR(n: number | null): string {
  if (n === null || n === undefined) return '-'
  return '€ ' + n.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function margePct(omzet: number | null, kosten: number | null): string {
  if (omzet === null || omzet === undefined || !omzet || kosten === null || kosten === undefined) return '-'
  return `${(((omzet - kosten) / omzet) * 100).toFixed(0)}%`
}

// Binaire zoektocht naar het kleinste aantal gebruikers waarbij de winst de
// doelwinst haalt, uitgaande van dezelfde tarieven/%-verdeling/betaalprovider-
// instellingen als het scenarioblok. Winst is niet perfect lineair (staffels
// bij ElevenLabs/Upstash, vaste kosten per maand), maar wel monotoon stijgend
// in n, dus binaire zoektocht volstaat, geen closed-form nodig.
const MAX_GEBRUIKERS_ZOEKGRENS = 2_000_000

// Team-scenario (aantal teamklanten, gemiddelde leden) staat los van n en
// wordt hier bewust constant gehouden terwijl n wordt gezocht: dezelfde
// aanpak als billingSplit/verdeling/betaalprovider hierboven, dat zijn ook
// vaste aannames tijdens het zoeken.
function winstBijN(
  n: number, billingSplit: ScenarioBillingSplit,
  verdeling: TierVerdeling, betaalprovider: Betaalprovider, team: TeamScenario, teamBillingSplit: TeamBillingSplit
): number {
  const { basicN, proN, teamLeden, omzetTotaal, betaalproviderKosten } = berekenScenarioOmzetEnBetaalprovider(SCENARIO_PRIJZEN, billingSplit, verdeling, betaalprovider, n, SCENARIO_TEAM_PRIJS, team, teamBillingSplit)
  const kostenEur = computeScenarioKosten(DEFAULT_INPUTS, basicN, proN, teamLeden).totaal / FX_EUR_USD
  return omzetTotaal - kostenEur - betaalproviderKosten
}

function benodigdeGebruikersVoorWinst(
  doelWinstEur: number, billingSplit: ScenarioBillingSplit,
  verdeling: TierVerdeling, betaalprovider: Betaalprovider, team: TeamScenario, teamBillingSplit: TeamBillingSplit
): number | null {
  if (winstBijN(MAX_GEBRUIKERS_ZOEKGRENS, billingSplit, verdeling, betaalprovider, team, teamBillingSplit) < doelWinstEur) return null
  let lo = 0
  let hi = MAX_GEBRUIKERS_ZOEKGRENS
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (winstBijN(mid, billingSplit, verdeling, betaalprovider, team, teamBillingSplit) >= doelWinstEur) hi = mid
    else lo = mid + 1
  }
  return lo
}

// Zelfde stijlconstanten als KostenCalculatorClient.tsx (tab 1), bewust
// letterlijk gelijk gehouden zodat alle drie de tabbladen consistent ogen.
const cardStyle: React.CSSProperties = {
  background: '#1a2333', border: '1px solid #2d3a4f', borderRadius: 12,
  padding: '20px 22px', marginBottom: 18,
}
const cardHeadStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
  color: '#94a3b8', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
}
const dotStyle: React.CSSProperties = { width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }
const statLabel: React.CSSProperties = { fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }
const statValue: React.CSSProperties = { fontSize: 22, fontWeight: 700, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }
// Zelfde stijl als statValue, alleen amber: bewust geen eigen lineHeight, zodat
// de tekst exact op dezelfde baseline staat als de andere bedragen ernaast.
const headlineValueStyle: React.CSSProperties = { ...statValue, color: '#f59e0b' }
const statCellStyle: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '10px 14px', textAlign: 'right',
}
// Identiek aan numberInputStyle in KostenCalculatorClient.tsx
const numberInputStyle: React.CSSProperties = {
  width: 84, background: '#1f2937', border: '1.5px solid #2d3a4f', borderRadius: 6,
  color: '#f1f5f9', padding: '7px 10px', fontSize: 13.5, textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
}
const fieldLabelStyle: React.CSSProperties = { fontSize: 13.5, color: '#f1f5f9' }

// formatThousands: toont/parseert de waarde met een duizendtal-punt (nl-NL,
// bv. "10.000"), voor gehele-getal-velden als aantal gebruikers/doelwinst.
// Bewust een losse tak i.p.v. het standaard number-input aanpassen: nl-NL
// gebruikt een komma als decimaalteken, dat zou de percentage-/decimaalvelden
// elders (stap 0.1/0.01) juist breken.
function NumberField({ label, hint, value, onChange, step = 1, formatThousands = false }: {
  label: string; hint?: React.ReactNode; value: number; onChange: (v: number) => void; step?: number; formatThousands?: boolean
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div>
        <div style={fieldLabelStyle}>{label}</div>
        {hint && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{hint}</div>}
      </div>
      {formatThousands ? (
        <input
          type="text"
          inputMode="numeric"
          value={value.toLocaleString('nl-NL')}
          style={{ ...numberInputStyle, width: '100%' }}
          onChange={e => onChange(parseInt(e.target.value.replace(/\D/g, ''), 10) || 0)}
        />
      ) : (
        <input type="number" value={value} step={step} style={{ ...numberInputStyle, width: '100%' }} onChange={e => onChange(parseFloat(e.target.value) || 0)} />
      )}
    </div>
  )
}

function TariefField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div style={statLabel}>{label}</div>
      <input
        type="number"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        style={{ ...numberInputStyle, width: 100, fontSize: 22, fontWeight: 700, textAlign: 'left' }}
      />
    </div>
  )
}

// Zelfde weergave als TariefField, maar zonder input: voor tarieven die niet
// meer instelbaar zijn (Basic/Pro zijn definitief vast, zie lib/kostenTarieven.ts).
function TariefDisplay({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={statLabel}>{label}</div>
      <div style={{ ...numberInputStyle, width: 100, fontSize: 22, fontWeight: 700, textAlign: 'left', display: 'flex', alignItems: 'center' }}>
        {value}
      </div>
    </div>
  )
}

type Props = {
  nGebruikers: number
  setNGebruikers: (n: number) => void
  tierVerdeling: TierVerdeling
  setTierVerdeling: (v: TierVerdeling) => void
  billingSplit: ScenarioBillingSplit
  setBillingSplit: (b: ScenarioBillingSplit) => void
  betaalprovider: Betaalprovider
  setBetaalprovider: (b: Betaalprovider) => void
  teamScenario: TeamScenario
  setTeamScenario: (t: TeamScenario) => void
  teamBillingSplit: TeamBillingSplit
  setTeamBillingSplit: (t: TeamBillingSplit) => void
}

export default function BusinessCaseClient({
  nGebruikers, setNGebruikers,
  tierVerdeling: scenarioPct, setTierVerdeling: setScenarioPct,
  billingSplit, setBillingSplit,
  betaalprovider, setBetaalprovider,
  teamScenario, setTeamScenario,
  teamBillingSplit, setTeamBillingSplit,
}: Props) {
  const [doelWinst, setDoelWinst] = useState(10000)

  const scenario = useMemo(() => {
    const { basicN, proN, omzet, teamLeden, teamOmzet, omzetTotaal, betaalproviderKosten: betaalKosten, basicPrijsGemiddeld, proPrijsGemiddeld, teamBasisGemiddeld, teamPerGebruikerGemiddeld } =
      berekenScenarioOmzetEnBetaalprovider(SCENARIO_PRIJZEN, billingSplit, scenarioPct, betaalprovider, nGebruikers, SCENARIO_TEAM_PRIJS, teamScenario, teamBillingSplit)
    const kostenUsd = computeScenarioKosten(DEFAULT_INPUTS, basicN, proN, teamLeden).totaal
    const kostenEur = kostenUsd / FX_EUR_USD
    return { basicN, proN, omzet, teamLeden, teamOmzet, omzetTotaal, kostenEur, betaalKosten, basicPrijsGemiddeld, proPrijsGemiddeld, teamBasisGemiddeld, teamPerGebruikerGemiddeld }
  }, [nGebruikers, scenarioPct, billingSplit, betaalprovider, teamScenario, teamBillingSplit])

  const totaalGebruikers = scenario.basicN + scenario.proN + scenario.teamLeden
  const pctTeamVanTotaal = totaalGebruikers > 0 ? (scenario.teamLeden / totaalGebruikers) * 100 : 0

  const benodigdeGebruikers = useMemo(
    () => benodigdeGebruikersVoorWinst(doelWinst, billingSplit, scenarioPct, betaalprovider, teamScenario, teamBillingSplit),
    [doelWinst, billingSplit, scenarioPct, betaalprovider, teamScenario, teamBillingSplit]
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginBottom: 18 }}>
        <TariefDisplay label="Basic (€)" value={String(DEFAULT_PRIJZEN.basis)} />
        <TariefDisplay label="Pro (€)" value={String(DEFAULT_PRIJZEN.premium)} />
        <TariefDisplay label="Team basis (€)" value={`${SCENARIO_TEAM_PRIJS.basisMaandelijks}/${SCENARIO_TEAM_PRIJS.basisJaarlijksTotaal / 12}`} />
        <TariefDisplay label="Team per gebruiker (€)" value={`${SCENARIO_TEAM_PRIJS.perGebruikerMaandelijks}/${SCENARIO_TEAM_PRIJS.perGebruikerJaarlijksTotaal / 12}`} />
      </div>

      <div style={cardStyle}>
        <div style={cardHeadStyle}><span style={dotStyle} />Scenario: prognose bij schaal</div>
        <NumberField label="Totaal aantal gebruikers" hint="gedeeld met de Calculator (tab 1)" value={nGebruikers} onChange={setNGebruikers} formatThousands />

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 48 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 4 }}>
              Verdeling abonnementen &amp; betaalcyclus
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12, minHeight: 32 }}>
              Basic € {SCENARIO_PRIJZEN.basicMaandelijks}/mnd &middot; € {SCENARIO_PRIJZEN.basicJaarlijksTotaal}/jr, Pro € {SCENARIO_PRIJZEN.proMaandelijks}/mnd &middot; € {SCENARIO_PRIJZEN.proJaarlijksTotaal}/jr
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 100px)', gap: 28, marginBottom: 12 }}>
              <TariefField label="% Basic" value={scenarioPct.basic} onChange={v => setScenarioPct({ basic: v, pro: 100 - v })} />
              <TariefField label="% Pro" value={scenarioPct.pro} onChange={v => setScenarioPct({ basic: 100 - v, pro: v })} />
              <TariefDisplay label="# Basic" value={String(scenario.basicN)} />
              <TariefDisplay label="# Pro" value={String(scenario.proN)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 100px)', gap: 28 }}>
              <TariefField label="% BASIS x12" value={billingSplit.basicPctJaarlijks} onChange={v => setBillingSplit({ ...billingSplit, basicPctJaarlijks: v })} />
              <TariefField label="% PRO x12" value={billingSplit.proPctJaarlijks} onChange={v => setBillingSplit({ ...billingSplit, proPctJaarlijks: v })} />
              <TariefDisplay label="€ Basic" value={'€ ' + Math.round(scenario.basicN * scenario.basicPrijsGemiddeld).toLocaleString('nl-NL')} />
              <TariefDisplay label="€ Pro" value={'€ ' + Math.round(scenario.proN * scenario.proPrijsGemiddeld).toLocaleString('nl-NL')} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 4 }}>
              Team
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12, minHeight: 32 }}>
              <div>Maandelijks: € {SCENARIO_TEAM_PRIJS.basisMaandelijks}/account + € {SCENARIO_TEAM_PRIJS.perGebruikerMaandelijks}/user</div>
              <div>Jaarlijks: € {SCENARIO_TEAM_PRIJS.basisJaarlijksTotaal / 12}/account + € {SCENARIO_TEAM_PRIJS.perGebruikerJaarlijksTotaal / 12}/user (€ {SCENARIO_TEAM_PRIJS.basisJaarlijksTotaal}/jr + € {SCENARIO_TEAM_PRIJS.perGebruikerJaarlijksTotaal}/user/jr)</div>
            </div>
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginBottom: 12 }}>
              <TariefField label="# teamklanten" value={teamScenario.aantalKlanten} onChange={v => setTeamScenario({ ...teamScenario, aantalKlanten: v })} />
              <TariefField label="# teamleden" value={teamScenario.gemiddeldeLeden} onChange={v => setTeamScenario({ ...teamScenario, gemiddeldeLeden: v })} />
              <TariefDisplay label="% team van totaal" value={`${pctTeamVanTotaal.toFixed(0)}%`} />
            </div>
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
              <TariefField label="% Team jaarlijks" value={teamBillingSplit.pctJaarlijks} onChange={v => setTeamBillingSplit({ pctJaarlijks: v })} />
              <TariefDisplay label="Team basis (€)" value={scenario.teamBasisGemiddeld.toFixed(2)} />
              <TariefDisplay label="Team p/user (€)" value={scenario.teamPerGebruikerGemiddeld.toFixed(2)} />
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 4 }}>
            Omzet, kosten, winst
          </div>
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginTop: 12 }}>
            <div>
              <div style={statLabel}>Verdeling</div>
              <div style={{ fontSize: 13, color: '#94a3b8' }}>{scenario.basicN} basic &middot; {scenario.proN} pro &middot; {scenario.teamLeden} teamleden</div>
            </div>
            <div>
              <div style={statLabel}>Gemiddelde prijs/maand</div>
              <div style={{ fontSize: 13, color: '#94a3b8' }}>€ {scenario.basicPrijsGemiddeld.toFixed(2)} basic &middot; € {scenario.proPrijsGemiddeld.toFixed(2)} pro</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, auto)', justifyContent: 'start', columnGap: 10, rowGap: 10, marginTop: 12 }}>
            <div style={statCellStyle}><div style={statLabel}>Omzet Solo</div><div style={statValue}>{fmtEUR(scenario.omzet)}</div></div>
            <div style={statCellStyle}><div style={statLabel}>Omzet Team</div><div style={statValue}>{fmtEUR(scenario.teamOmzet)}</div></div>
            <div style={statCellStyle}><div style={statLabel}>Omzet totaal</div><div style={headlineValueStyle}>{fmtEUR(scenario.omzetTotaal)}</div></div>

            <div style={statCellStyle}><div style={statLabel}>Kosten AI/infra</div><div style={statValue}>{fmtEUR(scenario.kostenEur)}</div></div>
            <div style={statCellStyle}><div style={statLabel}>Betaalprovider</div><div style={statValue}>{fmtEUR(scenario.betaalKosten)}</div></div>
            <div style={statCellStyle}><div style={statLabel}>Kosten totaal</div><div style={statValue}>{fmtEUR(scenario.kostenEur + scenario.betaalKosten)}</div></div>

            <div style={statCellStyle}><div style={statLabel}># users</div><div style={statValue}>{totaalGebruikers.toLocaleString('nl-NL')}</div></div>
            <div style={statCellStyle}><div style={statLabel}>Marge</div><div style={statValue}>{margePct(scenario.omzetTotaal, scenario.kostenEur + scenario.betaalKosten)}</div></div>
            <div style={statCellStyle}><div style={statLabel}>Winst</div><div style={headlineValueStyle}>{fmtEUR(scenario.omzetTotaal - scenario.kostenEur - scenario.betaalKosten)}</div></div>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={cardHeadStyle}><span style={dotStyle} />Doelwinst: hoeveel gebruikers heb je nodig?</div>
        <div style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 4 }}>
          <div>Berekening staat los van &quot;Totaal aantal gebruikers&quot; en verandert dat veld niet.</div>
          <div>Rekent met dezelfde tarieven en %-verdeling.</div>
        </div>
        <NumberField label="Doelwinst per maand (€)" value={doelWinst} step={100} onChange={setDoelWinst} formatThousands />
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginTop: 16 }}>
          <div>
            <div style={statLabel}>Benodigd aantal gebruikers</div>
            <div style={headlineValueStyle}>{benodigdeGebruikers === null ? 'niet haalbaar' : benodigdeGebruikers.toLocaleString('nl-NL')}</div>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={cardHeadStyle}><span style={dotStyle} />Betaalprovider (Emirates NBD Pay)</div>
        <NumberField label="Tarief (%)" value={betaalprovider.mdrPct} step={0.1} onChange={v => setBetaalprovider({ ...betaalprovider, mdrPct: v })} />
        <NumberField label="Vast bedrag per transactie (€)" hint="≈ AED 1" value={betaalprovider.mdrFixed} step={0.01} onChange={v => setBetaalprovider({ ...betaalprovider, mdrFixed: v })} />
        <NumberField
          label="% van omzet via creditcard"
          hint={<>
            <div>Geldt alleen voor Solo (Basic/Pro).</div>
            <div>Team loopt altijd via factuur; rest verondersteld via jaarfactuur, geen kaartkosten.</div>
          </>}
          value={betaalprovider.pctCreditcard} onChange={v => setBetaalprovider({ ...betaalprovider, pctCreditcard: v })}
        />
      </div>
    </div>
  )
}
