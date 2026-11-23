import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { controleerMobielToegang } from '@/lib/adminMobiel'
import {
  haalGebruikers, haalKosten, haalStatus, haalTeBeoordelen, haalPatronen, veilig,
} from '@/lib/adminMobielData'
import { ergsteNiveau, type Niveau } from '@/lib/adminMobielLogica'
import { nlDatumTekst, nlTijdTekst } from '@/lib/nlTijd'
import BeoordeeldKnop from './BeoordeeldKnop'
import Verversen from './Verversen'

export const dynamic = 'force-dynamic'

const UITLEG: Record<'ander-account' | 'geen-linkedin', string> = {
  'ander-account': 'Dit account heeft geen toegang tot deze pagina.',
  'geen-linkedin': 'Dit account is niet met LinkedIn gekoppeld, dus deze pagina blijft dicht.',
}

const KLEUR: Record<Niveau, string> = { ok: '#44cc88', 'let-op': '#f59e0b', fout: '#cc4444', onbekend: '#6b7280' }

const usd = (n: number) => `$${n.toFixed(2).replace('.', ',')}`
const kort = (iso: string) => `${nlDatumTekst(iso).slice(0, 5)} ${nlTijdTekst(iso).slice(0, 5)}`

function Stip({ niveau }: { niveau: Niveau }) {
  return <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: KLEUR[niveau], flexShrink: 0 }} />
}

function Kaart({ titel, niveau, samenvatting, open, children }: {
  titel: string; niveau?: Niveau; samenvatting: string; open?: boolean; children?: ReactNode
}) {
  return (
    <details open={open} style={{ background: '#1f2937', borderRadius: 4, marginBottom: 12 }}>
      <summary style={{ listStyle: 'none', cursor: 'pointer', padding: '16px 18px', minHeight: 44, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {niveau && <Stip niveau={niveau} />}
          <span style={{ color: '#f59e0b', fontSize: 12, letterSpacing: 3, fontWeight: 700 }}>{titel}</span>
        </span>
        <span style={{ color: '#f1f5f9', fontSize: 17 }}>{samenvatting}</span>
      </summary>
      {children && <div style={{ padding: '0 18px 16px', borderTop: '1px solid #374151', paddingTop: 12 }}>{children}</div>}
    </details>
  )
}

function Rij({ links, rechts, niveau }: { links: string; rechts: string; niveau?: Niveau }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '8px 0', fontSize: 14 }}>
      <span style={{ color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 8 }}>{niveau && <Stip niveau={niveau} />}{links}</span>
      <span style={{ color: '#f1f5f9', textAlign: 'right' }}>{rechts}</span>
    </div>
  )
}

function Mislukt({ titel }: { titel: string }) {
  return <Kaart titel={titel} niveau="onbekend" samenvatting="Ophalen mislukt, probeer te verversen." />
}

export default async function AdminMobielPage() {
  const toegang = await controleerMobielToegang()
  if (!toegang.ok && toegang.reden === 'niet-ingelogd') {
    redirect('/sign-in?redirect_url=/bot/admin/mobiel')
  }

  if (!toegang.ok) {
    return (
      <main style={{ background: '#111827', minHeight: '100vh', fontFamily: 'sans-serif', padding: '32px 20px' }}>
        <p style={{ color: '#f59e0b', fontSize: 12, letterSpacing: 4, margin: '0 0 12px' }}>ARNOBOT</p>
        <h1 style={{ color: '#f1f5f9', fontSize: 36, fontWeight: 700, margin: '0 0 24px', letterSpacing: -1 }}>Admin</h1>
        <p style={{ color: '#cc4444', fontSize: 15 }}>{UITLEG[toegang.reden as 'ander-account' | 'geen-linkedin']}</p>
      </main>
    )
  }

  const nu = new Date()
  // Elke kaart haalt zijn eigen gegevens op en valt apart om. Kosten wachten alleen op de namen uit de gebruikerskaart.
  const gebruikersP = veilig('gebruikers', () => haalGebruikers(nu))
  const kostenP = gebruikersP.then(g => veilig('kosten', () => haalKosten(g.ok ? g.data.namen : new Map(), nu)))

  const [gebruikers, kosten, status, beoordelen, patronen] = await Promise.all([
    gebruikersP,
    kostenP,
    veilig('status', () => haalStatus(0, nu)),
    veilig('te beoordelen', () => haalTeBeoordelen()),
    veilig('patronen', () => haalPatronen(nu)),
  ])

  // Het stoplicht bovenaan: ergste niveau van wat een actie van jou vraagt.
  const signalen: { niveau: Niveau; tekst: string }[] = []
  if (status.ok && status.data.niveau !== 'ok' && status.data.niveau !== 'onbekend') signalen.push({ niveau: status.data.niveau, tekst: 'status' })
  if (beoordelen.ok && beoordelen.data.length > 0) signalen.push({ niveau: 'let-op', tekst: `${beoordelen.data.length} te beoordelen` })
  if (patronen.ok && patronen.data.patronen.some(p => p.tweeWekenOpRij)) signalen.push({ niveau: 'let-op', tekst: 'terugkerend patroon' })
  const mislukt = [gebruikers, kosten, status, beoordelen, patronen].filter(s => !s.ok).length
  if (mislukt > 0) signalen.push({ niveau: 'let-op', tekst: `${mislukt} kaart${mislukt > 1 ? 'en' : ''} niet geladen` })
  const totaal = ergsteNiveau(signalen.map(s => s.niveau).concat('ok'))
  const kop = signalen.length === 0 ? 'Alles rustig' : signalen.map(s => s.tekst).join(' · ')

  return (
    <main style={{ background: '#111827', minHeight: '100vh', fontFamily: 'sans-serif', padding: '16px 16px 48px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ color: '#f59e0b', fontSize: 12, letterSpacing: 4 }}>ARNOBOT</span>
        <Verversen />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '0 0 24px' }}>
        <span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: '50%', background: KLEUR[totaal], flexShrink: 0 }} />
        <h1 style={{ color: '#f1f5f9', fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>{kop}</h1>
      </div>

      {/* Te beoordelen */}
      {beoordelen.ok ? (
        <Kaart
          titel="TE BEOORDELEN"
          niveau={beoordelen.data.length ? 'let-op' : 'ok'}
          samenvatting={beoordelen.data.length ? `${beoordelen.data.length} gemarkeerd bericht${beoordelen.data.length > 1 ? 'en' : ''}` : 'Niets te beoordelen'}
          open={beoordelen.data.length > 0}
        >
          {beoordelen.data.map(b => (
            <div key={b.id} style={{ padding: '10px 0', borderBottom: '1px solid #374151' }}>
              <p style={{ margin: '0 0 4px', color: '#f1f5f9', fontSize: 14 }}>{b.naam} <span style={{ color: '#6b7280' }}>· {b.categorie} · {kort(b.datum)}</span></p>
              <p style={{ margin: '0 0 10px', color: '#9ca3af', fontSize: 14, lineHeight: 1.4 }}>{b.bericht}</p>
              <BeoordeeldKnop id={b.id} />
            </div>
          ))}
        </Kaart>
      ) : <Mislukt titel="TE BEOORDELEN" />}

      {/* Status */}
      {status.ok ? (
        <Kaart
          titel="STATUS"
          niveau={status.data.niveau}
          samenvatting={status.data.problemen.length ? `${status.data.problemen.length} punt${status.data.problemen.length > 1 ? 'en' : ''} vragen aandacht` : 'Alles in orde'}
          open={status.data.problemen.length > 0}
        >
          {status.data.problemen.map((p, i) => (
            <p key={i} style={{ margin: '0 0 10px', color: '#f59e0b', fontSize: 14, lineHeight: 1.4 }}>{p}</p>
          ))}
          {status.data.regels.map(r => <Rij key={r.label} links={r.label} rechts={r.waarde} niveau={r.niveau} />)}
        </Kaart>
      ) : <Mislukt titel="STATUS" />}

      {/* Gebruikers */}
      {gebruikers.ok ? (
        <Kaart
          titel="GEBRUIKERS"
          samenvatting={`${gebruikers.data.samenvatting.actief7d} actief deze week · ${gebruikers.data.samenvatting.nieuw7d} nieuw`}
        >
          <Rij links="Actieve accounts" rechts={String(gebruikers.data.samenvatting.actiefAccount)} />
          <Rij links="Betalend" rechts={String(gebruikers.data.samenvatting.betalend)} />
          <Rij links="Gesprek laatste 7 dagen" rechts={String(gebruikers.data.samenvatting.actief7d)} />
          <Rij links="Nieuw laatste 7 dagen" rechts={String(gebruikers.data.samenvatting.nieuw7d)} />
          <p style={{ margin: '12px 0 4px', color: '#f59e0b', fontSize: 12, letterSpacing: 3 }}>PROEF LOOPT AF (7 DAGEN)</p>
          {gebruikers.data.samenvatting.bijnaVerlopen.length === 0
            ? <p style={{ margin: 0, color: '#6b7280', fontSize: 14 }}>Niemand</p>
            : gebruikers.data.samenvatting.bijnaVerlopen.map((v, i) => (
                <Rij key={i} links={v.naam} rechts={v.dagen === 0 ? 'vandaag' : v.dagen === 1 ? 'morgen' : `nog ${v.dagen} dagen`} niveau={v.dagen <= 1 ? 'let-op' : undefined} />
              ))}
        </Kaart>
      ) : <Mislukt titel="GEBRUIKERS" />}

      {/* Kosten */}
      {kosten.ok ? (
        <Kaart titel="KOSTEN DEZE MAAND" samenvatting={usd(kosten.data.totaalUsd)}>
          {kosten.data.top.map((t, i) => <Rij key={i} links={t.naam} rechts={usd(t.usd)} />)}
          {kosten.data.restUsd > 0 && <Rij links="Overige gebruikers" rechts={usd(kosten.data.restUsd)} />}
          {kosten.data.internUsd > 0 && <Rij links="Test en intern" rechts={usd(kosten.data.internUsd)} />}
          <p style={{ margin: '12px 0 4px', color: '#f59e0b', fontSize: 12, letterSpacing: 3 }}>PER LEVERANCIER</p>
          <Rij links="Anthropic" rechts={usd(kosten.data.perLeverancier.anthropic)} />
          <Rij links="Spraak (ElevenLabs)" rechts={usd(kosten.data.perLeverancier.spraak)} />
          <Rij links="Voyage" rechts={usd(kosten.data.perLeverancier.voyage)} />
          <Rij links="Dicteren en audio" rechts={usd(kosten.data.perLeverancier.audio)} />
          {kosten.data.zonderPrijs > 0 && (
            <p style={{ margin: '10px 0 0', color: '#6b7280', fontSize: 13 }}>{kosten.data.zonderPrijs} aanroepen zonder bekend tarief tellen als nul.</p>
          )}
        </Kaart>
      ) : <Mislukt titel="KOSTEN DEZE MAAND" />}

      {/* Waarheidscontrole en patronen */}
      {patronen.ok ? (
        <Kaart
          titel="WAARHEIDSCONTROLE"
          niveau={patronen.data.patronen.some(p => p.tweeWekenOpRij) ? 'let-op' : 'ok'}
          samenvatting={patronen.data.laatsteMail ? `Laatste mail: ${kort(patronen.data.laatsteMail)}` : 'Nog geen mail verstuurd'}
        >
          <p style={{ margin: '0 0 8px', color: '#6b7280', fontSize: 13 }}>{patronen.data.antwoorden} antwoorden in de afgelopen 7 dagen. De steekproef zelf staat in de mail.</p>
          {patronen.data.patronen.length === 0
            ? <p style={{ margin: 0, color: '#9ca3af', fontSize: 14 }}>Geen terugkerende patronen gevonden.</p>
            : patronen.data.patronen.map(p => (
                <Rij key={p.naam} links={p.naam} rechts={`${p.deze} nu · ${p.vorige} vorige week`} niveau={p.tweeWekenOpRij ? 'let-op' : undefined} />
              ))}
        </Kaart>
      ) : <Mislukt titel="WAARHEIDSCONTROLE" />}
    </main>
  )
}
