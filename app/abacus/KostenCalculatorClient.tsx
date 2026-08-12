'use client'

import { useState, useMemo } from 'react'
import {
  TARIEVEN, computeScenarioKosten, type Inputs,
  berekenScenarioOmzetEnBetaalprovider, SCENARIO_PRIJZEN, SCENARIO_TEAM_PRIJS,
  type ScenarioBillingSplit, type TierVerdeling, type Betaalprovider, type TeamScenario, type TeamBillingSplit,
} from '@/lib/kostenTarieven'

// Zelfde stille clamping als BusinessCaseClient.tsx (besloten 2026-08-11,
// gevonden bij audit: dit tabblad miste de bescherming die tab 3 al kreeg,
// waardoor bv. %-velden zoals pctSparring/pctVoice zonder waarschuwing >100
// geaccepteerd werden).
function clamp(v: number, min: number, max = Infinity): number {
  return Math.min(Math.max(v, min), max)
}

function fmtUSD(n: number): string {
  const sign = n < 0 ? '-' : ''
  return sign + '$' + Math.abs(n).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtUSD0(n: number): string {
  const sign = n < 0 ? '-' : ''
  return sign + '$' + Math.round(Math.abs(n)).toLocaleString('nl-NL')
}
function fmtEUR0(n: number): string {
  const sign = n < 0 ? '-' : ''
  return sign + '€ ' + Math.round(Math.abs(n)).toLocaleString('nl-NL')
}

const cardStyle: React.CSSProperties = {
  background: '#1a2333', border: '1px solid #2d3a4f', borderRadius: 12,
  padding: '20px 22px', marginBottom: 18,
}
const cardHeadStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
  color: '#94a3b8', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
}
const dotStyle: React.CSSProperties = { width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }
const fieldRowStyle: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 100px', gap: 12, alignItems: 'center',
  padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
}
const fieldLabelStyle: React.CSSProperties = { fontSize: 13.5, color: '#f1f5f9' }
const fieldHintStyle: React.CSSProperties = { fontSize: 12, color: '#6b7280', marginTop: 2 }
const numberInputStyle: React.CSSProperties = {
  width: '100%', background: '#1f2937', border: '1.5px solid #2d3a4f', borderRadius: 6,
  color: '#f1f5f9', padding: '7px 10px', fontSize: 13.5, textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
}
const breakdownLineStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0',
  borderBottom: '1px solid rgba(255,255,255,0.04)',
}

function NumberField({ label, hint, value, onChange, step = 1, min = 0, max = Infinity }: {
  label: string; hint?: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number
}) {
  return (
    <div style={fieldRowStyle}>
      <div>
        <div style={fieldLabelStyle}>{label}</div>
        {hint && <div style={fieldHintStyle}>{hint}</div>}
      </div>
      <input
        type="number"
        value={value}
        step={step}
        style={numberInputStyle}
        onChange={e => onChange(clamp(parseFloat(e.target.value) || 0, min, max))}
      />
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ position: 'relative', width: 42, height: 24, flexShrink: 0, display: 'inline-block' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', margin: 0, cursor: 'pointer' }}
      />
      <span style={{
        position: 'absolute', inset: 0, borderRadius: 999,
        background: checked ? 'rgba(245,158,11,0.12)' : '#2d3a4f',
        border: checked ? '1px solid #f59e0b' : 'none',
        transition: 'background 0.15s',
      }} />
      <span style={{
        position: 'absolute', top: 3, left: checked ? 21 : 3, width: 18, height: 18,
        borderRadius: '50%', background: checked ? '#f59e0b' : '#94a3b8',
        transition: 'left 0.15s',
      }} />
    </label>
  )
}

type Props = {
  nGebruikers: number
  setNGebruikers: (n: number) => void
  tierVerdeling: TierVerdeling
  billingSplit: ScenarioBillingSplit
  betaalprovider: Betaalprovider
  teamScenario: TeamScenario
  teamBillingSplit: TeamBillingSplit
  inputs: Inputs
  setInputs: React.Dispatch<React.SetStateAction<Inputs>>
}

export default function KostenCalculatorClient({ nGebruikers, setNGebruikers, tierVerdeling, billingSplit, betaalprovider, teamScenario, teamBillingSplit, inputs, setInputs }: Props) {
  const [tiersOpen, setTiersOpen] = useState(false)

  // Tier-bewust, net als tab 3 (Business case): de instelbare aannames
  // hieronder (analyses, coaching, voice, enzovoort) gelden voor Pro-
  // gebruikers, Basic-gebruikers krijgen automatisch nul coaching/voice en
  // een vaste lage analyses-aanname (computeScenarioKosten in
  // lib/kostenTarieven.ts). Zo geven tab 1 en tab 3 bij hetzelfde aantal
  // gebruikers en dezelfde %-verdeling ook hetzelfde antwoord. Betaalprovider-
  // kosten horen hier ook bij de totale kosten, ook al zijn ze zelf omzet-
  // afhankelijk: vandaar dat verdeling/betaalprovider-instellingen gedeeld
  // zijn met tab 3. Tarieven zelf (SCENARIO_PRIJZEN) zijn definitief vast,
  // geen gedeelde state.
  // perGebruiker deelt bewust door het werkelijke totaal (basicN+proN+teamLeden),
  // niet door n (dat is alleen het solo-aantal): totaal bevat namelijk ook de
  // kosten van teamleden (die in computeScenarioKosten al als volwaardige
  // Pro-gebruikers meetellen, qua kosten nauwelijks anders dan een gewone Pro-
  // gebruiker). Delen door alleen n zou dezelfde kosten over te weinig mensen
  // uitsmeren, en het cijfer structureel opblazen zodra er een teamscenario
  // is ingesteld (besloten 2026-08-11, gevonden door Arno).
  function berekenKostenVoorN(n: number) {
    const { basicN, proN, teamLeden, betaalproviderKosten } = berekenScenarioOmzetEnBetaalprovider(SCENARIO_PRIJZEN, billingSplit, tierVerdeling, betaalprovider, n, SCENARIO_TEAM_PRIJS, teamScenario, teamBillingSplit)
    const basis = computeScenarioKosten(inputs, basicN, proN, teamLeden)
    const betaalKosten = betaalproviderKosten * inputs.fxRate
    const totaal = basis.totaal + betaalKosten
    const totaalGebruikers = basicN + proN + teamLeden
    return { ...basis, betaalKosten, totaal, totaalGebruikers, perGebruiker: totaalGebruikers > 0 ? totaal / totaalGebruikers : 0 }
  }

  function set<K extends keyof Inputs>(key: K, value: Inputs[K]) {
    setInputs(prev => ({ ...prev, [key]: value }))
  }
  function setTier(i: number, field: 'credits' | 'price', value: number) {
    setInputs(prev => {
      const tiers = prev.tiers.slice()
      tiers[i] = { ...tiers[i], [field]: value }
      return { ...prev, tiers }
    })
  }

  const result = useMemo(
    () => berekenKostenVoorN(nGebruikers),
    [inputs, nGebruikers, billingSplit, tierVerdeling, betaalprovider, teamScenario, teamBillingSplit]
  )

  const scaleRows = useMemo(
    () => [10, 50, 100, 200, 500].map(n => ({ n, ...berekenKostenVoorN(n) })),
    [inputs, billingSplit, tierVerdeling, betaalprovider, teamScenario, teamBillingSplit]
  )

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { background: #111827; color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; font-size: 14px; }
        input[type="number"]:focus { outline: none; border-color: #f59e0b; }
        details summary { cursor: pointer; }
        details summary::-webkit-details-marker { display: none; }
      `}</style>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(28px,4vw,48px) clamp(16px,3vw,32px) 64px' }}>
        <div style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#f59e0b', marginBottom: 8 }}>ArnoBot &middot; Interne businesscase</p>
          <h1 style={{ fontSize: 'clamp(22px,3vw,30px)', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 8 }}>Kostencalculator per user</h1>
          <p style={{ color: '#94a3b8', fontSize: 14, maxWidth: 640 }}>
            Alle aannames zijn los instelbaar: gebruiksvolume, Voice-adoptie, ElevenLabs-tiers en vaste infrastructuurkosten. Gelden voor Pro-users; Basic krijgt automatisch nul coaching/voice en een vaste lage analyses-aanname, dezelfde %-verdeling als tab 3 (Business case). Alles herberekent live.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(320px,420px)', gap: 24, alignItems: 'start' }}>
          <div>
            <div style={cardStyle}>
              <div style={cardHeadStyle}><span style={dotStyle} />Hoofdchat &amp; gebruik</div>
              <NumberField label="Berichten per user per maand" hint="redelijk actief; gemeten gemiddelde juli 2026 was 30" value={inputs.berichten} onChange={v => set('berichten', v)} />
              <NumberField label="Anthropic kosten per bericht ($)" hint="hoofdchat + Haiku-RAG-herschrijving" value={inputs.anthropicPerBericht} step={0.0001} onChange={v => set('anthropicPerBericht', v)} />
            </div>

            <div style={cardStyle}>
              <div style={cardHeadStyle}><span style={dotStyle} />Analyses</div>
              <NumberField label="Analyses per user per maand" hint="app/api/bot/coaching-analyse, heet /bot/analyses in de app, was BIEB" value={inputs.analysesPerGebruiker} onChange={v => set('analysesPerGebruiker', v)} />
              <NumberField label="Kosten per analyse ($)" hint="juli 2026 gemeten output ~1263 tekens + geschatte input" value={inputs.kostenPerAnalyse} step={0.001} onChange={v => set('kostenPerAnalyse', v)} />
            </div>

            <div style={cardStyle}>
              <div style={cardHeadStyle}><span style={dotStyle} />Fable 5 (coaching-synthese &amp; uitdaging)</div>
              <NumberField label="Coaching-syntheses per user/maand" hint="app/api/bot/coaching/route.ts, hoofdsynthese" value={inputs.coachingPerGebruiker} onChange={v => set('coachingPerGebruiker', v)} />
              <NumberField label="Kosten per coaching-synthese ($)" hint="max_tokens 4000, thinking telt mee" value={inputs.coachingKostenPerSynthese} step={0.01} onChange={v => set('coachingKostenPerSynthese', v)} />
              <NumberField label="Uitdagingen per user/maand" hint="app/api/bot/uitdaging/route.ts" value={inputs.uitdagingPerGebruiker} onChange={v => set('uitdagingPerGebruiker', v)} />
              <NumberField label="Kosten per uitdaging ($)" hint="max_tokens 600" value={inputs.uitdagingKostenPerStuk} step={0.005} onChange={v => set('uitdagingKostenPerStuk', v)} />
            </div>

            <div style={cardStyle}>
              <div style={cardHeadStyle}><span style={dotStyle} />Sparring</div>
              <NumberField label="% users dat sparring gebruikt" hint="aanname, geen harde data" value={inputs.pctSparring} max={100} onChange={v => set('pctSparring', v)} />
              <NumberField label="Sessies per sparring-user/maand" hint="juli 2026 gemeten: 9 sessies/2 users ≈ 4,5" value={inputs.sparringSessiesPerGebruiker} onChange={v => set('sparringSessiesPerGebruiker', v)} />
              <NumberField label="Berichten per sparringsessie" hint="juli 2026 gemeten: 17,7" value={inputs.berichtenPerSparringSessie} onChange={v => set('berichtenPerSparringSessie', v)} />
              <NumberField label="Kosten per sparringbericht ($)" hint="app/api/sparring/chat, Sonnet 4.6, geen RAG" value={inputs.kostenPerSparringBericht} step={0.001} onChange={v => set('kostenPerSparringBericht', v)} />
              <NumberField label="Kosten per debrief ($)" hint="app/api/sparring/debrief, volledig transcript als input" value={inputs.kostenPerDebrief} step={0.001} onChange={v => set('kostenPerDebrief', v)} />
            </div>

            <div style={cardStyle}>
              <div style={cardHeadStyle}><span style={dotStyle} />Overige Anthropic-routes</div>
              <NumberField label="Overig, per user/maand ($)" hint="session-end (Haiku x3), coaching-precheck, blog-synthese, verfijn, sessies-zoeken" value={inputs.overigeAnthropicPerGebruiker} step={0.01} onChange={v => set('overigeAnthropicPerGebruiker', v)} />
            </div>

            <div style={cardStyle}>
              <div style={cardHeadStyle}><span style={dotStyle} />Voice (ElevenLabs + Whisper)</div>
              <NumberField label="% users met Voice actief" hint="aanname, geen harde data" value={inputs.pctVoice} max={100} onChange={v => set('pctVoice', v)} />
              <NumberField label="Interacties per Voice-user/maand" value={inputs.voiceInteracties} onChange={v => set('voiceInteracties', v)} />
              <NumberField label="Tekens per gesproken antwoord" hint="doellengte buildVoiceSystemPrompt: 400-600" value={inputs.tekensPerAntwoord} step={10} onChange={v => set('tekensPerAntwoord', v)} />
              <NumberField label="ElevenLabs credits per teken" hint="Flash v2.5, ElevenLabs zelf bevestigt 0,5-1, dit is de veilige kant" value={inputs.creditPerTeken} step={0.05} onChange={v => set('creditPerTeken', v)} />
              <NumberField label="Whisper + Anthropic-voice per interactie ($)" value={inputs.kostenPerInteractie} step={0.0005} onChange={v => set('kostenPerInteractie', v)} />

              <details open={tiersOpen} onToggle={e => setTiersOpen((e.target as HTMLDetailsElement).open)} style={{ marginTop: 10 }}>
                <summary style={{ fontSize: 12.5, color: '#94a3b8', padding: '4px 0' }}>
                  {tiersOpen ? '▾' : '▸'} ElevenLabs plan-tiers (credits &amp; prijs aanpasbaar)
                </summary>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', gap: 8, fontSize: 12.5, alignItems: 'center', marginTop: 10 }}>
                  <div style={{ color: '#6b7280', fontSize: 11, textTransform: 'uppercase' }}>Plan</div>
                  <div style={{ color: '#6b7280', fontSize: 11, textTransform: 'uppercase' }}>Credits</div>
                  <div style={{ color: '#6b7280', fontSize: 11, textTransform: 'uppercase' }}>$/maand</div>
                  {inputs.tiers.map((t, i) => (
                    <div key={t.name} style={{ display: 'contents' }}>
                      <div style={{ padding: '4px 0' }}>{t.name}</div>
                      <input type="number" value={t.credits} style={{ ...numberInputStyle, padding: '5px 8px', fontSize: 12.5 }}
                        onChange={e => setTier(i, 'credits', parseFloat(e.target.value) || 0)} />
                      <input type="number" value={t.price} style={{ ...numberInputStyle, padding: '5px 8px', fontSize: 12.5 }}
                        onChange={e => setTier(i, 'price', parseFloat(e.target.value) || 0)} />
                    </div>
                  ))}
                </div>
              </details>
            </div>

            <div style={cardStyle}>
              <div style={cardHeadStyle}><span style={dotStyle} />Vaste infrastructuurkosten</div>
              <NumberField label="Domeinverlenging (Porkbun, $/jaar)" value={inputs.domeinPerJaar} onChange={v => set('domeinPerJaar', v)} />
              <NumberField label="Vercel Pro, aantal seats" hint="1 = alleen jijzelf" value={inputs.vercelSeats} onChange={v => set('vercelSeats', v)} />
              <NumberField label="Vercel prijs per seat ($)" value={inputs.vercelPerSeat} onChange={v => set('vercelPerSeat', v)} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={fieldLabelStyle}>Supabase Pro ($25/maand)</div>
                <Toggle checked={inputs.supabasePro} onChange={v => set('supabasePro', v)} />
              </div>
              <div style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={fieldLabelStyle}>Supabase PITR ($100/maand)</div>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: result.totaalGebruikers >= TARIEVEN.supabasePitrDrempel ? '#f59e0b' : '#6b7280' }}>
                    {result.totaalGebruikers >= TARIEVEN.supabasePitrDrempel ? 'AAN' : 'UIT'}
                  </span>
                </div>
                <div style={fieldHintStyle}>Geen aparte toggle: telt automatisch mee zodra het aantal users (incl. team) de {TARIEVEN.supabasePitrDrempel} bereikt. Pro geeft al gratis dagelijkse backups (7 dagen); dit voegt alleen herstel tot op de minuut toe.</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <div style={fieldLabelStyle}>Clerk Pro ($100/maand)</div>
                  <div style={fieldHintStyle}>alleen nodig voor inactivity-timeout, niet voor aantal users (Free dekt tot 50.000 MRU)</div>
                </div>
                <Toggle checked={inputs.clerkPro} onChange={v => set('clerkPro', v)} />
              </div>
              <NumberField label="Sentry (€/maand)" value={inputs.sentryEur} onChange={v => set('sentryEur', v)} />
              <NumberField label="EUR → USD koers" value={inputs.fxRate} step={0.01} onChange={v => set('fxRate', v)} />
              <NumberField label="Upstash gratis tier (commands/maand)" hint="huidige limiet: 500.000" value={inputs.upstashFreeLimit} step={10000} onChange={v => set('upstashFreeLimit', v)} />
              <NumberField label="Upstash commands per bericht" value={inputs.upstashPerBericht} onChange={v => set('upstashPerBericht', v)} />
              <NumberField label="Upstash prijs per 100k commands ($)" value={inputs.upstashPrice} step={0.01} onChange={v => set('upstashPrice', v)} />
            </div>
          </div>

          <div style={{ position: 'sticky', top: 20 }}>
            <div style={{ ...cardStyle, background: 'linear-gradient(180deg, rgba(245,158,11,0.08), rgba(245,158,11,0.02))', border: '1px solid rgba(245,158,11,0.35)' }}>
              <div style={{ ...cardHeadStyle, color: '#f59e0b' }}><span style={dotStyle} />Resultaat</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <label style={{ fontSize: 12.5, color: '#94a3b8' }} htmlFor="nGebruikers">Aantal solo users</label>
                <input
                  id="nGebruikers"
                  type="number"
                  value={nGebruikers}
                  style={{ ...numberInputStyle, width: 90, fontSize: 16, fontWeight: 700, padding: '8px 10px' }}
                  onChange={e => setNGebruikers(clamp(parseFloat(e.target.value) || 0, 0, 2_000_000))}
                />
              </div>
              <p style={{ fontSize: 11.5, color: '#6b7280', marginBottom: 14 }}>Basic + Pro. Team-leden komen hier apart bovenop, zie toelichting onderaan.</p>
              <div style={{ fontSize: 12.5, color: '#94a3b8' }}>Totale kosten per user per maand</div>
              <div style={{ fontSize: 'clamp(36px,5vw,48px)', fontWeight: 800, color: '#f59e0b', lineHeight: 1, margin: '4px 0 2px', fontVariantNumeric: 'tabular-nums' }}>
                {fmtUSD(result.perGebruiker)}
              </div>
              <div style={{ fontSize: 11.5, color: '#6b7280' }}>Incl. team: {result.totaalGebruikers.toLocaleString('nl-NL')} users</div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                Totaal alle kosten: <b style={{ color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>{fmtUSD0(result.totaal)}</b> / maand
                <span style={{ color: '#6b7280' }}> (&asymp; {fmtEUR0(result.totaal / inputs.fxRate)}, vergelijk met tab 3)</span>
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={breakdownLineStyle}><span style={{ color: '#94a3b8' }}>Vaste infrastructuur</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtUSD0(result.vastKosten)}</span></div>
                <div style={breakdownLineStyle}><span style={{ color: '#94a3b8' }}>Anthropic hoofdchat</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(result.anthropicKosten)}</span></div>
                <div style={breakdownLineStyle}><span style={{ color: '#94a3b8' }}>Analyses</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(result.analysesKosten)}</span></div>
                <div style={breakdownLineStyle}><span style={{ color: '#94a3b8' }}>Fable 5 (coaching + uitdaging)</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(result.fable5Kosten)}</span></div>
                <div style={breakdownLineStyle}><span style={{ color: '#94a3b8' }}>Sparring</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(result.sparringKosten)}</span></div>
                <div style={breakdownLineStyle}><span style={{ color: '#94a3b8' }}>Overige Anthropic-routes</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(result.overigeAnthropicKosten)}</span></div>
                <div style={breakdownLineStyle}><span style={{ color: '#94a3b8' }}>ElevenLabs ({result.elevenName})</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(result.elevenPrice)}</span></div>
                <div style={breakdownLineStyle}><span style={{ color: '#94a3b8' }}>Whisper + Anthropic-voice</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(result.whisperKosten)}</span></div>
                <div style={breakdownLineStyle}><span style={{ color: '#94a3b8' }}>Upstash overage</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(result.upstashKosten)}</span></div>
                <div style={breakdownLineStyle}><span style={{ color: '#94a3b8' }}>Team-overhead (1:1-voorbereiding, teamoverzicht)</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(result.teamOverheadKosten)}</span></div>
                <div style={breakdownLineStyle}><span style={{ color: '#94a3b8' }}>Betaalprovider (Emirates NBD Pay)</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(result.betaalKosten)}</span></div>
                <div style={{ ...breakdownLineStyle, borderBottom: 'none' }}>
                  <span style={{ color: '#f59e0b', fontWeight: 700 }}>Totaal</span>
                  <span style={{ color: '#f59e0b', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtUSD0(result.totaal)}</span>
                </div>
              </div>
              <p style={{ fontSize: 12, color: '#6b7280', marginTop: 12 }}>
                %-verdeling Basic/Pro, betaalcyclus, Team-aantallen en betaalprovider-instellingen komen van tab 3 (Business case), dit tabblad kent zelf geen prijzen. Teamleden (inclusief de manager) tellen mee als extra Pro-users, plus een kleine teamspecifieke meerkost.
              </p>
            </div>

            <div style={cardStyle}>
              <div style={cardHeadStyle}><span style={dotStyle} />Op andere schaalniveaus</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600, padding: '6px 4px', borderBottom: '1px solid #2d3a4f' }}>Solo</th>
                    <th style={{ textAlign: 'right', fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600, padding: '6px 4px', borderBottom: '1px solid #2d3a4f' }}>Incl. team</th>
                    <th style={{ textAlign: 'right', fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600, padding: '6px 4px', borderBottom: '1px solid #2d3a4f' }}>Totaal/mnd</th>
                    <th style={{ textAlign: 'right', fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600, padding: '6px 4px', borderBottom: '1px solid #2d3a4f' }}>Per user</th>
                  </tr>
                </thead>
                <tbody>
                  {scaleRows.map(row => (
                    <tr key={row.n}>
                      <td style={{ padding: '8px 4px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{row.n.toLocaleString('nl-NL')}</td>
                      <td style={{ textAlign: 'right', padding: '8px 4px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#6b7280' }}>{row.totaalGebruikers.toLocaleString('nl-NL')}</td>
                      <td style={{ textAlign: 'right', padding: '8px 4px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{fmtUSD0(row.totaal)}</td>
                      <td style={{ textAlign: 'right', padding: '8px 4px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#f59e0b', fontWeight: 700 }}>{fmtUSD(row.perGebruiker)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: 12, color: '#6b7280', marginTop: 10, lineHeight: 1.6 }}>Zelfde variabelen als hierboven, alleen het aantal users wijzigt per rij.</p>
            </div>

            <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
              Alle bedragen in USD, tenzij anders aangegeven (Sentry in EUR, omgerekend). ElevenLabs-plan wordt automatisch gekozen als de goedkoopste tier die het totale creditverbruik dekt; boven Business wordt in hele Business-veelvouden gerekend.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
