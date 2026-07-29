'use client'

import { useState, useMemo } from 'react'

type Tier = { name: string; credits: number; price: number }

type Inputs = {
  berichten: number
  anthropicPerBericht: number
  biebPerGebruiker: number
  pctVoice: number
  voiceInteracties: number
  tekensPerAntwoord: number
  creditPerTeken: number
  kostenPerInteractie: number
  tiers: Tier[]
  vercelSeats: number
  vercelPerSeat: number
  supabasePro: boolean
  clerkPro: boolean
  sentryEur: number
  fxRate: number
  upstashFreeLimit: number
  upstashPerBericht: number
  upstashPrice: number
  nGebruikers: number
}

const DEFAULT_INPUTS: Inputs = {
  berichten: 30,
  anthropicPerBericht: 0.0148,
  biebPerGebruiker: 0.01,
  pctVoice: 30,
  voiceInteracties: 30,
  tekensPerAntwoord: 500,
  creditPerTeken: 0.5,
  kostenPerInteractie: 0.004,
  tiers: [
    { name: 'Starter', credits: 30000, price: 6 },
    { name: 'Creator', credits: 121000, price: 22 },
    { name: 'Pro', credits: 600000, price: 99 },
    { name: 'Scale', credits: 1800000, price: 299 },
    { name: 'Business', credits: 6000000, price: 990 },
  ],
  vercelSeats: 2,
  vercelPerSeat: 20,
  supabasePro: true,
  clerkPro: false,
  sentryEur: 26,
  fxRate: 1.08,
  upstashFreeLimit: 500000,
  upstashPerBericht: 10,
  upstashPrice: 0.2,
  nGebruikers: 50,
}

function fmtUSD(n: number): string {
  return '$' + n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtUSD0(n: number): string {
  return '$' + Math.round(n).toLocaleString('nl-NL')
}

function elevenLabsCost(creditsNeeded: number, tiers: Tier[]): { price: number; name: string } {
  if (creditsNeeded <= 0) return { price: 0, name: '-' }
  for (const t of tiers) {
    if (creditsNeeded <= t.credits) return { price: t.price, name: t.name }
  }
  const business = tiers[tiers.length - 1]
  const multiples = Math.ceil(creditsNeeded / business.credits)
  return { price: business.price * multiples, name: `${business.name} x${multiples}` }
}

function computeForN(inputs: Inputs, n: number) {
  const totaalBerichten = n * inputs.berichten
  const anthropicKosten = totaalBerichten * inputs.anthropicPerBericht + n * inputs.biebPerGebruiker

  const voiceGebruikers = n * (inputs.pctVoice / 100)
  const totaalInteracties = voiceGebruikers * inputs.voiceInteracties
  const totaalTekens = totaalInteracties * inputs.tekensPerAntwoord
  const creditsNodig = totaalTekens * inputs.creditPerTeken
  const eleven = elevenLabsCost(creditsNodig, inputs.tiers)
  const whisperKosten = totaalInteracties * inputs.kostenPerInteractie

  const upstashCommands = totaalBerichten * inputs.upstashPerBericht
  const upstashOverage = Math.max(0, upstashCommands - inputs.upstashFreeLimit)
  const upstashKosten = (upstashOverage / 100000) * inputs.upstashPrice

  const sentryUsd = inputs.sentryEur * inputs.fxRate
  const vastKosten = inputs.vercelSeats * inputs.vercelPerSeat
    + (inputs.supabasePro ? 25 : 0)
    + (inputs.clerkPro ? 100 : 0)
    + sentryUsd

  const totaal = vastKosten + anthropicKosten + eleven.price + whisperKosten + upstashKosten

  return {
    vastKosten, anthropicKosten, elevenPrice: eleven.price, elevenName: eleven.name,
    whisperKosten, upstashKosten, totaal, perGebruiker: n > 0 ? totaal / n : 0,
  }
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

function NumberField({ label, hint, value, onChange, step = 1 }: {
  label: string; hint?: string; value: number; onChange: (v: number) => void; step?: number
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
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
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

export default function KostenCalculatorClient() {
  const [inputs, setInputs] = useState<Inputs>(DEFAULT_INPUTS)
  const [tiersOpen, setTiersOpen] = useState(false)

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

  const result = useMemo(() => computeForN(inputs, inputs.nGebruikers), [inputs])
  const scaleRows = useMemo(
    () => [10, 50, 100, 200, 500].map(n => ({ n, ...computeForN(inputs, n) })),
    [inputs]
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
          <h1 style={{ fontSize: 'clamp(22px,3vw,30px)', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 8 }}>Kostencalculator per gebruiker</h1>
          <p style={{ color: '#94a3b8', fontSize: 14, maxWidth: 640 }}>
            Alle aannames zijn los instelbaar: gebruiksvolume, Voice-adoptie, ElevenLabs-tiers en vaste infrastructuurkosten. Alles herberekent live.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(320px,420px)', gap: 24, alignItems: 'start' }}>
          <div>
            <div style={cardStyle}>
              <div style={cardHeadStyle}><span style={dotStyle} />Hoofdchat &amp; gebruik</div>
              <NumberField label="Berichten per gebruiker per maand" hint="gemeten gemiddelde juli 2026: 30" value={inputs.berichten} onChange={v => set('berichten', v)} />
              <NumberField label="Anthropic kosten per bericht ($)" hint="hoofdchat + Haiku-RAG-herschrijving" value={inputs.anthropicPerBericht} step={0.0001} onChange={v => set('anthropicPerBericht', v)} />
              <NumberField label="BIEB-kosten per gebruiker/maand ($)" hint="losse gespreksanalyse" value={inputs.biebPerGebruiker} step={0.001} onChange={v => set('biebPerGebruiker', v)} />
            </div>

            <div style={cardStyle}>
              <div style={cardHeadStyle}><span style={dotStyle} />Voice (ElevenLabs + Whisper)</div>
              <NumberField label="% gebruikers met Voice actief" hint="aanname, geen harde data" value={inputs.pctVoice} onChange={v => set('pctVoice', v)} />
              <NumberField label="Interacties per Voice-gebruiker/maand" value={inputs.voiceInteracties} onChange={v => set('voiceInteracties', v)} />
              <NumberField label="Tekens per gesproken antwoord" hint="doellengte buildVoiceSystemPrompt: 400-600" value={inputs.tekensPerAntwoord} step={10} onChange={v => set('tekensPerAntwoord', v)} />
              <NumberField label="ElevenLabs credits per teken" hint="Flash v2.5" value={inputs.creditPerTeken} step={0.05} onChange={v => set('creditPerTeken', v)} />
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
              <NumberField label="Vercel Pro, aantal seats" value={inputs.vercelSeats} onChange={v => set('vercelSeats', v)} />
              <NumberField label="Vercel prijs per seat ($)" value={inputs.vercelPerSeat} onChange={v => set('vercelPerSeat', v)} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={fieldLabelStyle}>Supabase Pro ($25/maand)</div>
                <Toggle checked={inputs.supabasePro} onChange={v => set('supabasePro', v)} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <div style={fieldLabelStyle}>Clerk Pro ($100/maand)</div>
                  <div style={fieldHintStyle}>alleen nodig voor inactivity-timeout, niet voor gebruikersaantal (Free dekt tot 50.000 MRU)</div>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <label style={{ fontSize: 12.5, color: '#94a3b8' }} htmlFor="nGebruikers">Aantal gebruikers</label>
                <input
                  id="nGebruikers"
                  type="number"
                  value={inputs.nGebruikers}
                  style={{ ...numberInputStyle, width: 90, fontSize: 16, fontWeight: 700, padding: '8px 10px' }}
                  onChange={e => set('nGebruikers', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div style={{ fontSize: 12.5, color: '#94a3b8' }}>Totale kosten per gebruiker per maand</div>
              <div style={{ fontSize: 'clamp(36px,5vw,48px)', fontWeight: 800, color: '#f59e0b', lineHeight: 1, margin: '4px 0 2px', fontVariantNumeric: 'tabular-nums' }}>
                {fmtUSD(result.perGebruiker)}
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                Totaal alle kosten: <b style={{ color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>{fmtUSD0(result.totaal)}</b> / maand
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={breakdownLineStyle}><span style={{ color: '#94a3b8' }}>Vaste infrastructuur</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtUSD0(result.vastKosten)}</span></div>
                <div style={breakdownLineStyle}><span style={{ color: '#94a3b8' }}>Anthropic hoofdchat + BIEB</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(result.anthropicKosten)}</span></div>
                <div style={breakdownLineStyle}><span style={{ color: '#94a3b8' }}>ElevenLabs ({result.elevenName})</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(result.elevenPrice)}</span></div>
                <div style={breakdownLineStyle}><span style={{ color: '#94a3b8' }}>Whisper + Anthropic-voice</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(result.whisperKosten)}</span></div>
                <div style={breakdownLineStyle}><span style={{ color: '#94a3b8' }}>Upstash overage</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(result.upstashKosten)}</span></div>
                <div style={{ ...breakdownLineStyle, borderBottom: 'none' }}>
                  <span style={{ color: '#f59e0b', fontWeight: 700 }}>Totaal</span>
                  <span style={{ color: '#f59e0b', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtUSD0(result.totaal)}</span>
                </div>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={cardHeadStyle}><span style={dotStyle} />Op andere schaalniveaus</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600, padding: '6px 4px', borderBottom: '1px solid #2d3a4f' }}>Gebruikers</th>
                    <th style={{ textAlign: 'right', fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600, padding: '6px 4px', borderBottom: '1px solid #2d3a4f' }}>Totaal/mnd</th>
                    <th style={{ textAlign: 'right', fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600, padding: '6px 4px', borderBottom: '1px solid #2d3a4f' }}>Per gebruiker</th>
                  </tr>
                </thead>
                <tbody>
                  {scaleRows.map(row => (
                    <tr key={row.n}>
                      <td style={{ padding: '8px 4px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{row.n.toLocaleString('nl-NL')}</td>
                      <td style={{ textAlign: 'right', padding: '8px 4px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{fmtUSD0(row.totaal)}</td>
                      <td style={{ textAlign: 'right', padding: '8px 4px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#f59e0b', fontWeight: 700 }}>{fmtUSD(row.perGebruiker)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: 12, color: '#6b7280', marginTop: 10, lineHeight: 1.6 }}>Zelfde variabelen als hierboven, alleen het aantal gebruikers wijzigt per rij.</p>
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
