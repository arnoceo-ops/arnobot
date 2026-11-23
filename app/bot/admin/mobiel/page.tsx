import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { controleerMobielToegang } from '@/lib/adminMobiel'
import {
  haalGebruikers, haalKosten, haalStatus, haalTeBeoordelen, haalPatronen, haalGeld, haalTeams, veilig,
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
const euro = (cent: number) => `€${(cent / 100).toFixed(2).replace('.', ',')}`
const kort = (iso: string) => `${nlDatumTekst(iso).slice(0, 5)} ${nlTijdTekst(iso).slice(0, 5)}`
const datum = (iso: string) => nlDatumTekst(iso).slice(0, 5)
const dagenTekst = (d: number) => (d === 0 ? 'vandaag' : d === 1 ? 'morgen' : `nog ${d} dagen`)

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

function Kop({ tekst }: { tekst: string }) {
  return <p style={{ margin: '14px 0 4px', color: '#f59e0b', fontSize: 12, letterSpacing: 3 }}>{tekst}</p>
}

function Leeg({ tekst }: { tekst: string }) {
  return <p style={{ margin: 0, color: '#6b7280', fontSize: 14 }}>{tekst}</p>
}

function Rij({ links, rechts, niveau }: { links: string; rechts?: string; niveau?: Niveau }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '8px 0', fontSize: 14 }}>
      <span style={{ color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>{niveau && <Stip niveau={niveau} />}{links}</span>
      {rechts && <span style={{ color: '#9ca3af', textAlign: 'right' }}>{rechts}</span>}
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
  // Elke kaart haalt zijn eigen gegevens op en valt apart om. Kosten, geld en te beoordelen wachten alleen op de
  // namen en rijen uit de gebruikerskaart; zonder die kaart tonen ze 'onbekend' in plaats van een naam.
  const gebruikersP = veilig('gebruikers', () => haalGebruikers(nu))
  const namenVan = (g: Awaited<typeof gebruikersP>) => (g.ok ? g.data.namen : new Map<string, string>())
  const kostenP = gebruikersP.then(g => veilig('kosten', () => haalKosten(namenVan(g), nu)))
  const geldP = gebruikersP.then(g => veilig('geld', () => haalGeld(namenVan(g), nu)))
  const beoordelenP = gebruikersP.then(g => veilig('te beoordelen', () => haalTeBeoordelen(namenVan(g), g.ok ? g.data.rijen : [], nu)))

  const [gebruikers, kosten, geld, beoordelen, status, teams, patronen] = await Promise.all([
    gebruikersP,
    kostenP,
    geldP,
    beoordelenP,
    veilig('status', () => haalStatus(0, nu)),
    veilig('teams', () => haalTeams(nu)),
    veilig('patronen', () => haalPatronen(nu)),
  ])

  const terugkerend = patronen.ok ? patronen.data.filter(p => p.tweeWekenOpRij) : []
  const aantalBeoordelen = (beoordelen.ok ? beoordelen.data.offtopic.length + beoordelen.data.duimpjes.length + beoordelen.data.bel.length : 0) + terugkerend.length

  // Het stoplicht bovenaan: ergste niveau van wat een actie van jou vraagt.
  const signalen: { niveau: Niveau; tekst: string }[] = []
  if (status.ok && (status.data.niveau === 'let-op' || status.data.niveau === 'fout')) signalen.push({ niveau: status.data.niveau, tekst: 'status' })
  if (aantalBeoordelen > 0) signalen.push({ niveau: 'let-op', tekst: `${aantalBeoordelen} te beoordelen` })
  if (geld.ok && (geld.data.mislukt.length > 0 || geld.data.openTeamFacturen.length > 0)) signalen.push({ niveau: 'let-op', tekst: 'geld' })
  if (teams.ok) {
    const ergste = ergsteNiveau(teams.data.teams.map(t => t.niveau))
    if (ergste === 'let-op' || ergste === 'fout') signalen.push({ niveau: ergste, tekst: 'teams' })
    if (teams.data.aanvragen.some(a => new Date(a.datum).getTime() > nu.getTime() - 7 * 864e5)) signalen.push({ niveau: 'let-op', tekst: 'teamaanvraag' })
  }
  const mislukt = [gebruikers, kosten, geld, beoordelen, status, teams, patronen].filter(s => !s.ok).length
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
          niveau={aantalBeoordelen ? 'let-op' : 'ok'}
          samenvatting={aantalBeoordelen ? `${aantalBeoordelen} ${aantalBeoordelen === 1 ? 'punt' : 'punten'}` : 'Niets te beoordelen'}
          open={aantalBeoordelen > 0}
        >
          {beoordelen.data.offtopic.length > 0 && (
            <>
              <Kop tekst="GEMARKEERD: OFF-TOPIC" />
              {beoordelen.data.offtopic.map(b => (
                <div key={b.id} style={{ padding: '10px 0', borderBottom: '1px solid #374151' }}>
                  <p style={{ margin: '0 0 4px', color: '#f1f5f9', fontSize: 14 }}>{b.naam} <span style={{ color: '#6b7280' }}>· {b.categorie} · {kort(b.datum)}</span></p>
                  <p style={{ margin: '0 0 10px', color: '#9ca3af', fontSize: 14, lineHeight: 1.4 }}>{b.bericht}</p>
                  <BeoordeeldKnop id={b.id} />
                </div>
              ))}
            </>
          )}
          {beoordelen.data.duimpjes.length > 0 && (
            <>
              <Kop tekst="NEGATIEF DUIMPJE, LAATSTE 7 DAGEN" />
              {beoordelen.data.duimpjes.map((d, i) => (
                <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #374151' }}>
                  <p style={{ margin: '0 0 2px', color: '#f1f5f9', fontSize: 14 }}>{d.naam} <span style={{ color: '#6b7280' }}>· {kort(d.datum)}</span></p>
                  <p style={{ margin: 0, color: '#9ca3af', fontSize: 14, lineHeight: 1.4 }}>{d.vraag}</p>
                </div>
              ))}
            </>
          )}
          {beoordelen.data.bel.length > 0 && (
            <>
              <Kop tekst="BELLEN: PROEF LOOPT AF, WEINIG GEBRUIKT" />
              {beoordelen.data.bel.map((b, i) => (
                <Rij key={i} links={b.naam} rechts={`${dagenTekst(b.dagen)} · ${b.vragen} ${b.vragen === 1 ? 'vraag' : 'vragen'}`} niveau={b.dagen <= 1 ? 'let-op' : undefined} />
              ))}
            </>
          )}
          {terugkerend.length > 0 && (
            <>
              <Kop tekst="TERUGKEREND PATROON, TWEE WEKEN OP RIJ" />
              {terugkerend.map(p => <Rij key={p.naam} links={p.naam} rechts={`${p.deze} nu · ${p.vorige} vorige week`} niveau="let-op" />)}
            </>
          )}
          {aantalBeoordelen === 0 && <Leeg tekst="Geen gemarkeerde berichten, geen negatieve duimpjes, niemand om te bellen." />}
        </Kaart>
      ) : <Mislukt titel="TE BEOORDELEN" />}

      {/* Geld */}
      {geld.ok ? (
        <Kaart
          titel="GELD"
          niveau={geld.data.mislukt.length || geld.data.openTeamFacturen.length ? 'let-op' : 'ok'}
          samenvatting={`${euro(geld.data.maandCent)} deze maand${geld.data.mislukt.length ? ` · ${geld.data.mislukt.length} mislukt` : ''}`}
          open={geld.data.mislukt.length > 0 || geld.data.openTeamFacturen.length > 0}
        >
          {geld.data.mislukt.length > 0 && (
            <>
              <Kop tekst="MISLUKT, LAATSTE 14 DAGEN" />
              {geld.data.mislukt.map((m, i) => <Rij key={i} links={m.naam} rechts={`${euro(m.cent)} · ${m.status === 'expired' ? 'verlopen' : 'mislukt'} · ${datum(m.datum)}`} niveau="let-op" />)}
            </>
          )}
          {geld.data.openTeamFacturen.length > 0 && (
            <>
              <Kop tekst="TEAMFACTUREN: OPEN OF VERLOPEN" />
              {geld.data.openTeamFacturen.map((f, i) => <Rij key={i} links={f.team} rechts={`${euro(f.cent)} · ${f.status === 'expired' ? 'verlopen' : 'open'} · ${datum(f.datum)}`} niveau="let-op" />)}
            </>
          )}
          <Kop tekst={`DEZE WEEK BETAALD: ${euro(geld.data.weekCent)}`} />
          {geld.data.week.length === 0 ? <Leeg tekst="Geen betalingen deze week" /> : geld.data.week.map((w, i) => <Rij key={i} links={w.naam} rechts={`${euro(w.cent)} · ${datum(w.datum)}`} />)}
          <Kop tekst="OPGEZEGD (LOOPT NOG)" />
          {geld.data.opgezegd.length === 0 ? <Leeg tekst="Niemand" /> : geld.data.opgezegd.map((o, i) => <Rij key={i} links={o.naam} rechts={o.plan} />)}
        </Kaart>
      ) : <Mislukt titel="GELD" />}

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
          samenvatting={`${gebruikers.data.samenvatting.actief7d} actief deze week · ${gebruikers.data.samenvatting.nieuw7d} nieuw · ${gebruikers.data.samenvatting.betalend} betalend`}
        >
          <Kop tekst={`ACTIEF DEZE WEEK (${gebruikers.data.samenvatting.actief7d})`} />
          {gebruikers.data.samenvatting.actiefLijst.length === 0 ? <Leeg tekst="Niemand" />
            : gebruikers.data.samenvatting.actiefLijst.map((a, i) => <Rij key={i} links={a.naam} rechts={`${a.gesprekken} ${a.gesprekken === 1 ? 'gesprek' : 'gesprekken'}`} />)}
          <Kop tekst={`NIEUW DEZE WEEK (${gebruikers.data.samenvatting.nieuw7d})`} />
          {gebruikers.data.samenvatting.nieuwLijst.length === 0 ? <Leeg tekst="Niemand" />
            : gebruikers.data.samenvatting.nieuwLijst.map((n, i) => <Rij key={i} links={n.naam} rechts={`${n.soort} · ${datum(n.datum)}`} />)}
          <Kop tekst={`BETALEND (${gebruikers.data.samenvatting.betalend})`} />
          {gebruikers.data.samenvatting.betalendLijst.length === 0 ? <Leeg tekst="Niemand" />
            : gebruikers.data.samenvatting.betalendLijst.map((b, i) => <Rij key={i} links={b.naam} rechts={b.plan} />)}
          <Kop tekst="PROEF LOOPT AF (7 DAGEN)" />
          {gebruikers.data.samenvatting.bijnaVerlopen.length === 0 ? <Leeg tekst="Niemand" />
            : gebruikers.data.samenvatting.bijnaVerlopen.map((v, i) => <Rij key={i} links={v.naam} rechts={dagenTekst(v.dagen)} niveau={v.dagen <= 1 ? 'let-op' : undefined} />)}
          <p style={{ margin: '14px 0 0', color: '#6b7280', fontSize: 13 }}>{gebruikers.data.samenvatting.actiefAccount} actieve accounts in totaal.</p>
        </Kaart>
      ) : <Mislukt titel="GEBRUIKERS" />}

      {/* Teams */}
      {teams.ok ? (
        <Kaart
          titel="TEAMS"
          niveau={ergsteNiveau(teams.data.teams.map(t => t.niveau).concat('ok'))}
          samenvatting={`${teams.data.teams.length} ${teams.data.teams.length === 1 ? 'team' : 'teams'}${teams.data.aanvragen.length ? ` · ${teams.data.aanvragen.length} aanvra${teams.data.aanvragen.length === 1 ? 'ag' : 'gen'} (30 dagen)` : ''}`}
          open={teams.data.teams.some(t => t.niveau !== 'ok')}
        >
          {teams.data.teams.length === 0 ? <Leeg tekst="Geen teams" /> : teams.data.teams.map((t, i) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #374151' }}>
              <Rij links={t.naam} rechts={`${t.leden} ${t.leden === 1 ? 'lid' : 'leden'}`} niveau={t.niveau} />
              <p style={{ margin: '0 0 2px 18px', color: '#9ca3af', fontSize: 13 }}>{t.manager} · {t.stand}</p>
            </div>
          ))}
          <Kop tekst="TEAMAANVRAGEN, LAATSTE 30 DAGEN" />
          {teams.data.aanvragen.length === 0 ? <Leeg tekst="Geen" />
            : teams.data.aanvragen.map((a, i) => <Rij key={i} links={`${a.bedrijf} (${a.aanvrager})`} rechts={`${a.seats ?? '?'} seats · ${datum(a.datum)}`} />)}
          <p style={{ margin: '14px 0 0', color: '#6b7280', fontSize: 13 }}>Een proef verlengen kan alleen op de pc.</p>
        </Kaart>
      ) : <Mislukt titel="TEAMS" />}

      {/* Kosten */}
      {kosten.ok ? (
        <Kaart titel="KOSTEN DEZE MAAND" samenvatting={usd(kosten.data.totaalUsd)}>
          {kosten.data.top.map((t, i) => <Rij key={i} links={t.naam} rechts={usd(t.usd)} />)}
          {kosten.data.restUsd > 0 && <Rij links="Overige gebruikers" rechts={usd(kosten.data.restUsd)} />}
          {kosten.data.internUsd > 0 && <Rij links="Test en intern" rechts={usd(kosten.data.internUsd)} />}
          <Kop tekst="PER LEVERANCIER" />
          <Rij links="Anthropic" rechts={usd(kosten.data.perLeverancier.anthropic)} />
          <Rij links="Spraak (ElevenLabs)" rechts={usd(kosten.data.perLeverancier.spraak)} />
          <Rij links="Voyage" rechts={usd(kosten.data.perLeverancier.voyage)} />
          <Rij links="Dicteren en audio" rechts={usd(kosten.data.perLeverancier.audio)} />
          {kosten.data.zonderPrijs > 0 && (
            <p style={{ margin: '10px 0 0', color: '#6b7280', fontSize: 13 }}>{kosten.data.zonderPrijs} aanroepen zonder bekend tarief tellen als nul.</p>
          )}
        </Kaart>
      ) : <Mislukt titel="KOSTEN DEZE MAAND" />}
    </main>
  )
}
