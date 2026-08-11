'use client'

import { useMemo, useState } from 'react'
import {
  DEFAULT_INPUTS, DEFAULT_PRIJZEN, computeScenarioKosten, berekenScenarioOmzetEnBetaalprovider, SCENARIO_PRIJZEN, SCENARIO_TEAM_PRIJS,
  type ScenarioBillingSplit, type TierVerdeling, type Betaalprovider, type TeamScenario, type TeamBillingSplit,
} from '@/lib/kostenTarieven'
import { TEAM_MIN_GEBRUIKERS } from '@/lib/teamPricing'

const FX_EUR_USD = 1.08

// Stille clamping i.p.v. een blokkade/foutmelding: dit is Arno's eigen interne
// tool, geen productieformulier. Voorkomt praktisch onmogelijke scenario's
// (bijv. % Pro dat via 100-% Basic negatief wordt bij het intypen van >100 in
// % Basic) die zonder validatie stilletjes onzinnige uitkomsten opleverden,
// zie het gesprek dat hiertoe leidde.
function clamp(v: number, min: number, max = Infinity): number {
  return Math.min(Math.max(v, min), max)
}

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

// Proportionele variant (besloten 2026-08-11, op Arno's verzoek naast de
// vaste-teamscenario-variant hierboven, niet als vervanging): i.p.v. team
// vast te houden terwijl alleen solo groeit, schalen solo-aantal én #
// teamklanten hier met dezelfde factor mee. Gemiddelde teamgrootte
// (# teamleden) is bewust een vast kenmerk, geen volumeknop, en schaalt niet
// mee. Zoekt op een continue schaalfactor i.p.v. een geheel aantal, vandaar
// een vaste-iteratiecount binaire zoektocht i.p.v. de integer-loop hierboven:
// 60 iteraties is ruim genoeg voor praktische precisie op elke realistische
// schaal.
const MAX_SCHAAL_ZOEKGRENS = 10_000_000

function winstBijSchaal(
  schaal: number, billingSplit: ScenarioBillingSplit, verdeling: TierVerdeling, betaalprovider: Betaalprovider,
  baseN: number, baseTeam: TeamScenario, teamBillingSplit: TeamBillingSplit
): number {
  const team: TeamScenario = { aantalKlanten: baseTeam.aantalKlanten * schaal, gemiddeldeLeden: baseTeam.gemiddeldeLeden }
  return winstBijN(baseN * schaal, billingSplit, verdeling, betaalprovider, team, teamBillingSplit)
}

function benodigdeSchaalVoorWinst(
  doelWinstEur: number, billingSplit: ScenarioBillingSplit, verdeling: TierVerdeling, betaalprovider: Betaalprovider,
  baseN: number, baseTeam: TeamScenario, teamBillingSplit: TeamBillingSplit
): { solo: number; teamKlanten: number; teamLeden: number; totaal: number } | null {
  // Bij solo=0 én teamklanten=0 kan een factor niets laten groeien (0 x schaal
  // blijft altijd 0), dus onbepaald i.p.v. eindeloos zoeken.
  if (baseN <= 0 && baseTeam.aantalKlanten <= 0) return null
  let hi = 1
  while (winstBijSchaal(hi, billingSplit, verdeling, betaalprovider, baseN, baseTeam, teamBillingSplit) < doelWinstEur) {
    if (hi > MAX_SCHAAL_ZOEKGRENS) return null
    hi *= 2
  }
  let lo = 0
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (winstBijSchaal(mid, billingSplit, verdeling, betaalprovider, baseN, baseTeam, teamBillingSplit) >= doelWinstEur) hi = mid
    else lo = mid
  }
  const solo = Math.round(baseN * hi)
  const teamKlanten = Math.round(baseTeam.aantalKlanten * hi)
  const teamLeden = teamKlanten * baseTeam.gemiddeldeLeden
  return { solo, teamKlanten, teamLeden, totaal: solo + teamLeden }
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
  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '10px 14px', textAlign: 'right', minHeight: 64,
}
// Identiek aan numberInputStyle in KostenCalculatorClient.tsx
const numberInputStyle: React.CSSProperties = {
  width: 84, background: '#1f2937', border: '1.5px solid #2d3a4f', borderRadius: 6,
  color: '#f1f5f9', padding: '7px 10px', fontSize: 13.5, textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
}
// Herkenning voor zelf-instelbare velden (besloten met Arno): een subtiele
// amber-tint op de rand, dezelfde kleur die de rest van de admin-UI al
// gebruikt voor "dit is actionable/interactief" i.p.v. een nieuwe kleurtaal.
// Alleen op echte <input>-velden (NumberField, TariefField), nooit op
// TariefDisplay (berekende, niet-instelbare waarden), die blijft neutraal.
const editableBorder = '1.5px solid rgba(245,158,11,0.35)'
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
          style={{ ...numberInputStyle, width: '100%', border: editableBorder }}
          onChange={e => onChange(parseInt(e.target.value.replace(/\D/g, ''), 10) || 0)}
        />
      ) : (
        <input type="number" value={value} step={step} style={{ ...numberInputStyle, width: '100%', border: editableBorder }} onChange={e => onChange(parseFloat(e.target.value) || 0)} />
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
        style={{ ...numberInputStyle, width: 100, height: 44, fontSize: 22, fontWeight: 700, textAlign: 'right', border: editableBorder }}
      />
    </div>
  )
}

// Vaste breedte (100px), geen ruimte om mee te groeien zoals de bredere
// stat-cellen verderop in de pagina. Bij een lange waarde (bijv. "€ 11.000")
// past het 22px-standaardfont niet meer op één regel en wrapt het vak naar
// twee regels, wat de hele rij ernaast scheeftrekt. Schaalt het font i.p.v.
// het vak te laten groeien.
function fitFontSize(value: string): number {
  if (value.length <= 6) return 22
  if (value.length <= 8) return 18
  if (value.length <= 10) return 15
  return 13
}

// Zelfde weergave als TariefField, maar zonder input: voor tarieven die niet
// meer instelbaar zijn (Basic/Pro zijn definitief vast, zie lib/kostenTarieven.ts).
function TariefDisplay({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={statLabel}>{label}</div>
      <div style={{ ...numberInputStyle, width: 100, height: 44, fontSize: fitFontSize(value), fontWeight: 700, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
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
  // Team schaalt bewust los van nGebruikers (zie berekenScenarioOmzetEnBetaalprovider
  // in lib/kostenTarieven.ts), zodat teamgroei onafhankelijk van solo-groei te
  // verkennen is. Geen harde blokkade hierop (zelfde reden als de clamp()-functie
  // hierboven: intern tool, legitieme stresstest-scenario's moeten kunnen), wel een
  // zichtbare melding als het teamvolume het solo-aantal met een veelvoud overstijgt,
  // zodat een verouderd/vergeten teamscenario (bijv. nog ingesteld op een veel grotere
  // testschaal) niet onopgemerkt een intern inconsistent totaalbeeld oplevert.
  const teamVsSoloRatio = nGebruikers > 0 ? scenario.teamLeden / nGebruikers : (scenario.teamLeden > 0 ? Infinity : 0)
  const teamVolumeWaarschuwing = scenario.teamLeden > 0 && teamVsSoloRatio > 5

  const benodigdeGebruikers = useMemo(
    () => benodigdeGebruikersVoorWinst(doelWinst, billingSplit, scenarioPct, betaalprovider, teamScenario, teamBillingSplit),
    [doelWinst, billingSplit, scenarioPct, betaalprovider, teamScenario, teamBillingSplit]
  )
  const benodigdeSchaal = useMemo(
    () => benodigdeSchaalVoorWinst(doelWinst, billingSplit, scenarioPct, betaalprovider, nGebruikers, teamScenario, teamBillingSplit),
    [doelWinst, billingSplit, scenarioPct, betaalprovider, nGebruikers, teamScenario, teamBillingSplit]
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginBottom: 18 }}>
        <TariefDisplay label="Basic (€)" value={String(DEFAULT_PRIJZEN.basis)} />
        <TariefDisplay label="Pro (€)" value={String(DEFAULT_PRIJZEN.premium)} />
        <TariefDisplay label="Team basis (€)" value={`${SCENARIO_TEAM_PRIJS.basisMaandelijks}/${SCENARIO_TEAM_PRIJS.basisJaarlijksTotaal / 12}`} />
        <TariefDisplay label="Team per user (€)" value={`${SCENARIO_TEAM_PRIJS.perGebruikerMaandelijks}/${SCENARIO_TEAM_PRIJS.perGebruikerJaarlijksTotaal / 12}`} />
      </div>

      <div style={cardStyle}>
        <div style={cardHeadStyle}><span style={dotStyle} />Scenario: prognose bij schaal</div>
        <NumberField
          label="Aantal solo users (Basic + Pro)"
          hint="Excl. Team, dat schaalt hieronder los (zie &quot;# teamklanten&quot;). Gedeeld met de Calculator (tab 1)."
          value={nGebruikers} onChange={setNGebruikers} formatThousands
        />

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 80 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 4 }}>
              Verdeling abonnementen &amp; betaalcyclus
            </div>
            <div style={{ fontSize: 12, lineHeight: '17px', color: '#6b7280', marginBottom: 12, height: 34 }}>
              Basic € {SCENARIO_PRIJZEN.basicMaandelijks}/mnd &middot; € {SCENARIO_PRIJZEN.basicJaarlijksTotaal}/jr, Pro € {SCENARIO_PRIJZEN.proMaandelijks}/mnd &middot; € {SCENARIO_PRIJZEN.proJaarlijksTotaal}/jr
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 100px)', gap: 28, marginBottom: 12 }}>
              <TariefField label="% Basic" value={scenarioPct.basic} onChange={v => { const c = clamp(v, 0, 100); setScenarioPct({ basic: c, pro: 100 - c }) }} />
              <TariefField label="% Pro" value={scenarioPct.pro} onChange={v => { const c = clamp(v, 0, 100); setScenarioPct({ basic: 100 - c, pro: c }) }} />
              <TariefDisplay label="# Basic" value={scenario.basicN.toLocaleString('nl-NL')} />
              <TariefDisplay label="# Pro" value={scenario.proN.toLocaleString('nl-NL')} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 100px)', gap: 28 }}>
              <TariefField label="% BASIS x12" value={billingSplit.basicPctJaarlijks} onChange={v => setBillingSplit({ ...billingSplit, basicPctJaarlijks: clamp(v, 0, 100) })} />
              <TariefField label="% PRO x12" value={billingSplit.proPctJaarlijks} onChange={v => setBillingSplit({ ...billingSplit, proPctJaarlijks: clamp(v, 0, 100) })} />
              <TariefDisplay label="€ Basic" value={'€ ' + Math.round(scenario.basicN * scenario.basicPrijsGemiddeld).toLocaleString('nl-NL')} />
              <TariefDisplay label="€ Pro" value={'€ ' + Math.round(scenario.proN * scenario.proPrijsGemiddeld).toLocaleString('nl-NL')} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 4 }}>
              Team
            </div>
            <div style={{ fontSize: 12, lineHeight: '17px', color: '#6b7280', marginBottom: 12, height: 34 }}>
              <div>Maandelijks: € {SCENARIO_TEAM_PRIJS.basisMaandelijks}/account + € {SCENARIO_TEAM_PRIJS.perGebruikerMaandelijks}/user</div>
              <div>Jaarlijks: € {SCENARIO_TEAM_PRIJS.basisJaarlijksTotaal / 12}/account + € {SCENARIO_TEAM_PRIJS.perGebruikerJaarlijksTotaal / 12}/user (€ {SCENARIO_TEAM_PRIJS.basisJaarlijksTotaal}/jr + € {SCENARIO_TEAM_PRIJS.perGebruikerJaarlijksTotaal}/user/jr)</div>
            </div>
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginBottom: 12 }}>
              <TariefField label="# teamklanten" value={teamScenario.aantalKlanten} onChange={v => setTeamScenario({ ...teamScenario, aantalKlanten: clamp(v, 0) })} />
              <TariefField label="# teamleden" value={teamScenario.gemiddeldeLeden} onChange={v => setTeamScenario({ ...teamScenario, gemiddeldeLeden: clamp(v, TEAM_MIN_GEBRUIKERS) })} />
              <TariefDisplay label="% team van totaal" value={`${pctTeamVanTotaal.toFixed(0)}%`} />
            </div>
            {teamVolumeWaarschuwing && (
              <p style={{ fontSize: 12, color: '#f59e0b', lineHeight: 1.5, marginBottom: 12 }}>
                Let op: {scenario.teamLeden.toLocaleString('nl-NL')} teamleden is {teamVsSoloRatio.toFixed(1)}&times; het aantal solo users hierboven ({nGebruikers.toLocaleString('nl-NL')}). Check of # teamklanten/# teamleden nog bij dit scenario passen.
              </p>
            )}
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
              <TariefField label="% Team jaarlijks" value={teamBillingSplit.pctJaarlijks} onChange={v => setTeamBillingSplit({ pctJaarlijks: clamp(v, 0, 100) })} />
              <TariefDisplay label="Team basis" value={'€ ' + Math.round(scenario.teamBasisGemiddeld).toLocaleString('nl-NL')} />
              <TariefDisplay label="Team p/user" value={'€ ' + Math.round(scenario.teamPerGebruikerGemiddeld).toLocaleString('nl-NL')} />
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', width: 1122, columnGap: 10, rowGap: 10, marginTop: 12 }}>
            <div style={statCellStyle}><div style={statLabel}>Omzet Solo</div><div style={statValue}>{fmtEUR(scenario.omzet)}</div></div>
            <div style={statCellStyle}><div style={statLabel}>Omzet Team</div><div style={statValue}>{fmtEUR(scenario.teamOmzet)}</div></div>
            <div style={statCellStyle}><div style={statLabel}>Omzet totaal</div><div style={headlineValueStyle}>{fmtEUR(scenario.omzetTotaal)}</div></div>

            <div style={statCellStyle}><div style={statLabel}>Kosten AI/infra</div><div style={statValue}>{fmtEUR(scenario.kostenEur)}</div></div>
            <div style={statCellStyle}><div style={statLabel}>Betaalprovider</div><div style={statValue}>{fmtEUR(scenario.betaalKosten)}</div></div>
            <div style={statCellStyle}><div style={statLabel}>Kosten totaal</div><div style={statValue}>{fmtEUR(scenario.kostenEur + scenario.betaalKosten)}</div></div>

            <div style={statCellStyle}><div style={statLabel}># users (incl. team)</div><div style={statValue}>{totaalGebruikers.toLocaleString('nl-NL')}</div></div>
            <div style={statCellStyle}><div style={statLabel}>Marge</div><div style={statValue}>{margePct(scenario.omzetTotaal, scenario.kostenEur + scenario.betaalKosten)}</div></div>
            <div style={statCellStyle}><div style={statLabel}>Winst</div><div style={headlineValueStyle}>{fmtEUR(scenario.omzetTotaal - scenario.kostenEur - scenario.betaalKosten)}</div></div>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={cardHeadStyle}><span style={dotStyle} />Doelwinst: hoeveel users heb je nodig?</div>
        <div style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 4 }}>
          <div>Berekening staat los van &quot;Aantal solo users&quot; hierboven en verandert dat veld niet. Rekent met dezelfde tarieven en %-verdeling.</div>
          <div>Twee varianten hieronder, zelfde doelbedrag, andere aanname over hoe team meegroeit.</div>
        </div>
        <NumberField label="Doelwinst per maand (€)" value={doelWinst} step={100} onChange={setDoelWinst} formatThousands />

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 80 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 4 }}>
              Team blijft vast
            </div>
            <div style={{ fontSize: 12, lineHeight: '17px', color: '#6b7280', marginBottom: 12, height: 34 }}>
              Team-scenario (# teamklanten/# teamleden) blijft tijdens het zoeken op de huidige instelling, alleen solo groeit.
            </div>
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
              <div>
                <div style={statLabel}>Benodigd aantal solo users</div>
                <div style={headlineValueStyle}>{benodigdeGebruikers === null ? 'niet haalbaar' : benodigdeGebruikers.toLocaleString('nl-NL')}</div>
              </div>
              <div>
                <div style={statLabel}>Totaal incl. huidig teamscenario</div>
                <div style={statValue}>
                  {benodigdeGebruikers === null ? '-' : (benodigdeGebruikers + scenario.teamLeden).toLocaleString('nl-NL')}
                </div>
                <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 2 }}>
                  = solo hierboven + de huidige {scenario.teamLeden.toLocaleString('nl-NL')} teamleden ({teamScenario.aantalKlanten} klanten &times; {teamScenario.gemiddeldeLeden})
                </div>
              </div>
            </div>
            {benodigdeGebruikers === 0 && (
              <p style={{ fontSize: 12, color: '#f59e0b', lineHeight: 1.5, marginTop: 12 }}>
                Je huidige teamscenario haalt dit doelbedrag al, zonder solo users.
              </p>
            )}
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 4 }}>
              Team schaalt mee
            </div>
            <div style={{ fontSize: 12, lineHeight: '17px', color: '#6b7280', marginBottom: 12, height: 34 }}>
              Solo-aantal en # teamklanten groeien in dezelfde verhouding als nu. Gemiddelde teamgrootte blijft gelijk.
            </div>
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
              <div>
                <div style={statLabel}>Benodigd aantal solo users</div>
                <div style={headlineValueStyle}>{benodigdeSchaal === null ? 'niet haalbaar' : benodigdeSchaal.solo.toLocaleString('nl-NL')}</div>
              </div>
              <div>
                <div style={statLabel}>Benodigd # teamklanten</div>
                <div style={statValue}>{benodigdeSchaal === null ? '-' : benodigdeSchaal.teamKlanten.toLocaleString('nl-NL')}</div>
                <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 2 }}>
                  {benodigdeSchaal === null ? '' : `= ${benodigdeSchaal.teamLeden.toLocaleString('nl-NL')} teamleden bij ${teamScenario.gemiddeldeLeden}/klant`}
                </div>
              </div>
              <div>
                <div style={statLabel}>Totaal</div>
                <div style={statValue}>{benodigdeSchaal === null ? '-' : benodigdeSchaal.totaal.toLocaleString('nl-NL')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={cardHeadStyle}><span style={dotStyle} />Betaalprovider (Emirates NBD Pay)</div>
        <NumberField label="Tarief (%)" value={betaalprovider.mdrPct} step={0.1} onChange={v => setBetaalprovider({ ...betaalprovider, mdrPct: clamp(v, 0) })} />
        <NumberField label="Vast bedrag per transactie (€)" hint="≈ AED 1" value={betaalprovider.mdrFixed} step={0.01} onChange={v => setBetaalprovider({ ...betaalprovider, mdrFixed: clamp(v, 0) })} />
        <NumberField
          label="% van omzet via creditcard"
          hint={<>
            <div>Geldt alleen voor Solo (Basic/Pro).</div>
            <div>Team loopt altijd via factuur; rest verondersteld via jaarfactuur, geen kaartkosten.</div>
          </>}
          value={betaalprovider.pctCreditcard} onChange={v => setBetaalprovider({ ...betaalprovider, pctCreditcard: clamp(v, 0, 100) })}
        />
      </div>
    </div>
  )
}
