import { getBlogDb } from '@/lib/blog'
import { getDailyBlogMailBudget } from '@/lib/blogMail'
import { StatCard, TileGrid, SubHeading, RatioBar } from './StatsUi'
import MaandGrafieken, { type MaandPunt } from './MaandGrafieken'
import AanmeldingenLijst, { type Aanmelding } from './AanmeldingenLijst'

// Tabblad BLOG op /bot/admin/stats: abonnees, groei, verzending, bezoek en per artikel.
// Alles zijn exacte tellingen in de database (head-count), geen rijen ophalen en zelf tellen,
// zodat het ook bij een groot aantal abonnees en pageviews snel en juist blijft.
// Het bezoek komt uit de eigen anonieme tellers (arnobot_pageviews, arnobot_cta_clicks), de
// bron van waarheid voor deze pagina, naast PostHog.

const DAY = 86_400_000
const MONTHS = 12
const RECENT_POSTS = 5
const RECENT_SIGNUPS = 50

type CountQuery = PromiseLike<{ count: number | null }>
const n = async (q: CountQuery): Promise<number> => (await q).count ?? 0

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0
}

async function laadBlogStats() {
  const db = getBlogDb()
  const now = Date.now()
  const since30 = new Date(now - 30 * DAY).toISOString()
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)

  const subs = () => db.from('arnobot_blog_subscribers').select('id', { count: 'exact', head: true })
  const deliveries = () => db.from('arnobot_blog_deliveries').select('id', { count: 'exact', head: true })
  const views = () => db.from('arnobot_pageviews').select('id', { count: 'exact', head: true }).gte('created_at', since30)
  const clicks = () => db.from('arnobot_cta_clicks').select('id', { count: 'exact', head: true }).gte('created_at', since30)

  // De laatste 12 maanden, oudste eerst, op UTC-maandgrenzen.
  const huidig = new Date(now)
  const maandBereiken = Array.from({ length: MONTHS }, (_, i) => {
    const start = Date.UTC(huidig.getUTCFullYear(), huidig.getUTCMonth() - (MONTHS - 1 - i), 1)
    const eind = Date.UTC(huidig.getUTCFullYear(), huidig.getUTCMonth() - (MONTHS - 2 - i), 1)
    return {
      label: new Date(start).toLocaleDateString('nl-NL', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
      from: new Date(start).toISOString(),
      to: new Date(eind).toISOString(),
    }
  })
  const eersteMaand = maandBereiken[0].from

  const [
    totaal, bevestigd, wachtOpBevestiging, afgemeld, ooitBevestigd, afgemeldNaBevestiging,
    wachtrij, mislukt, verzondenVandaag, blogBezoeken, blogKlikken,
    { data: posts },
    nieuwPerMaand, afgemeldPerMaand, bevestigdVoorStart, afgemeldVoorStart,
  ] = await Promise.all([
    n(subs()),
    n(subs().eq('status', 'confirmed')),
    n(subs().eq('status', 'pending')),
    n(subs().eq('status', 'unsubscribed')),
    n(subs().not('confirmed_at', 'is', null)),
    n(subs().eq('status', 'unsubscribed').not('confirmed_at', 'is', null)),
    n(deliveries().eq('status', 'queued')),
    n(deliveries().eq('status', 'failed')),
    n(deliveries().eq('status', 'sent').gte('sent_at', startOfDay.toISOString())),
    n(views().like('path', '/blog%')),
    n(clicks().like('path', '/blog%')),
    db.from('arnobot_blog_posts').select('id, slug, title, published_at').eq('status', 'published').order('published_at', { ascending: false }).limit(RECENT_POSTS),
    Promise.all(maandBereiken.map(m => n(subs().gte('confirmed_at', m.from).lt('confirmed_at', m.to)))),
    // Afmeldingen tellen alleen van wie eerst bevestigd had (een onbevestigde aanmelding is geen abonnee).
    Promise.all(maandBereiken.map(m => n(subs().not('confirmed_at', 'is', null).gte('unsubscribed_at', m.from).lt('unsubscribed_at', m.to)))),
    // Beginstand: abonnees vóór de eerste maand, zodat het totaal per maand klopt.
    n(subs().lt('confirmed_at', eersteMaand)),
    n(subs().not('confirmed_at', 'is', null).lt('unsubscribed_at', eersteMaand)),
  ])

  const recent = (posts ?? []) as { id: string; slug: string; title: string; published_at: string }[]
  const perPost = await Promise.all(recent.map(async p => {
    const path = `/blog/${p.slug}`
    const [verzonden, inWachtrij, gefaald, bezoeken, klikken, geopend, geklikt] = await Promise.all([
      n(deliveries().eq('post_id', p.id).eq('status', 'sent')),
      n(deliveries().eq('post_id', p.id).eq('status', 'queued')),
      n(deliveries().eq('post_id', p.id).eq('status', 'failed')),
      n(views().eq('path', path)),
      n(clicks().eq('path', path)),
      n(deliveries().eq('post_id', p.id).gt('opened_count', 0)),
      n(deliveries().eq('post_id', p.id).gt('clicked_count', 0)),
    ])
    return { ...p, verzonden, inWachtrij, gefaald, bezoeken, klikken, geopend, geklikt }
  }))

  // Wie doet wat: de recentste bezorgingen met een open of klik, per abonnee opgeteld. Begrensd op
  // de laatste 500 bezorgingen met activiteit, dat is ruim voldoende voor de top van de lijst.
  const { data: activiteit } = await db
    .from('arnobot_blog_deliveries')
    .select('subscriber_id, opened_count, clicked_count, last_opened_at, last_clicked_at')
    .or('opened_count.gt.0,clicked_count.gt.0')
    .order('last_clicked_at', { ascending: false, nullsFirst: false })
    .limit(500)
  type Act = { subscriber_id: string; opened_count: number; clicked_count: number; last_opened_at: string | null; last_clicked_at: string | null }
  const perAbonnee = new Map<string, { geklikt: number; geopend: number; laatste: string }>()
  for (const a of (activiteit ?? []) as Act[]) {
    const laatste = [a.last_clicked_at, a.last_opened_at].filter(Boolean).sort().pop() ?? ''
    const huidig = perAbonnee.get(a.subscriber_id) ?? { geklikt: 0, geopend: 0, laatste: '' }
    huidig.geklikt += a.clicked_count
    huidig.geopend += a.opened_count
    if (laatste > huidig.laatste) huidig.laatste = laatste
    perAbonnee.set(a.subscriber_id, huidig)
  }
  const top = [...perAbonnee.entries()]
    .sort((x, y) => y[1].geklikt - x[1].geklikt || y[1].geopend - x[1].geopend || y[1].laatste.localeCompare(x[1].laatste))
    .slice(0, 25)
  const ids = top.map(([id]) => id)
  const { data: abonnees } = ids.length
    ? await db.from('arnobot_blog_subscribers').select('id, email, voornaam, status').in('id', ids)
    : { data: [] as { id: string; email: string; voornaam: string | null; status: string }[] }
  const abonneeById = new Map(((abonnees ?? []) as { id: string; email: string; voornaam: string | null; status: string }[]).map(a => [a.id, a]))
  const emails = [...abonneeById.values()].map(a => a.email)
  // Is het adres al een ArnoBot-gebruiker? Handig om te zien of de lezers van de blog al gebruikers zijn.
  const { data: gebruikers } = emails.length
    ? await db.from('approved_users').select('email').in('email', emails)
    : { data: [] as { email: string }[] }
  const gebruikerEmails = new Set(((gebruikers ?? []) as { email: string }[]).map(g => g.email.toLowerCase()))
  const wieDoetWat = top.flatMap(([id, a]) => {
    const abonnee = abonneeById.get(id)
    if (!abonnee) return []
    return [{ ...a, naam: abonnee.voornaam ?? '', email: abonnee.email, status: abonnee.status, isGebruiker: gebruikerEmails.has(abonnee.email.toLowerCase()) }]
  })

  const { data: aanmeldingenRaw } = await db
    .from('arnobot_blog_subscribers')
    .select('id, email, voornaam, status, created_at')
    .order('created_at', { ascending: false })
    .limit(RECENT_SIGNUPS)
  const aanmeldingen = (aanmeldingenRaw ?? []) as Aanmelding[]

  let lopendTotaal = bevestigdVoorStart - afgemeldVoorStart
  const maandPunten: MaandPunt[] = maandBereiken.map((m, i) => {
    lopendTotaal += nieuwPerMaand[i] - afgemeldPerMaand[i]
    return { label: m.label, aanmeldingen: nieuwPerMaand[i], afmeldingen: afgemeldPerMaand[i], totaal: lopendTotaal }
  })

  return {
    totaal, bevestigd, wachtOpBevestiging, afgemeld, ooitBevestigd, afgemeldNaBevestiging,
    wachtrij, mislukt, verzondenVandaag, blogBezoeken, blogKlikken, perPost, maandPunten, wieDoetWat, aanmeldingen,
    budget: getDailyBlogMailBudget(),
    heeftGroei: maandPunten.some(p => p.aanmeldingen > 0 || p.afmeldingen > 0 || p.totaal > 0),
  }
}

export default async function BlogStats() {
  const {
    totaal, bevestigd, wachtOpBevestiging, afgemeld, ooitBevestigd, afgemeldNaBevestiging,
    wachtrij, mislukt, verzondenVandaag, blogBezoeken, blogKlikken, perPost, maandPunten, wieDoetWat, aanmeldingen, budget, heeftGroei,
  } = await laadBlogStats()

  const cell = { fontFamily: 'sans-serif', fontSize: 14, color: '#f1f5f9', padding: '10px 8px', borderBottom: '1px solid #374151' } as const
  const head = { fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 2, color: '#6b7280', padding: '0 8px 8px', textAlign: 'left', borderBottom: '1px solid #374151' } as const

  return (
    <div>
      <TileGrid>
        <StatCard label="ABONNEES" stats={[
          { sublabel: 'BEVESTIGD', value: String(bevestigd) },
          { sublabel: 'WACHT OP BEVESTIGING', value: String(wachtOpBevestiging) },
          { sublabel: 'AFGEMELD', value: String(afgemeld) },
        ]} footnote="Abonneren is altijd op alle artikelen. Alleen bevestigde abonnees ontvangen mail." />

        <StatCard label="CONVERSIE"
          footnote="Bevestiging: van alle aanmeldingen, hoeveel hebben op de link in de mail geklikt. Afmelding: van wie ooit bevestigd heeft, hoeveel zich later hebben afgemeld.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <RatioBar label="BEVESTIGD" ratio={pct(ooitBevestigd, totaal)} note={`n=${totaal}`} />
            <RatioBar label="AFGEMELD" ratio={pct(afgemeldNaBevestiging, ooitBevestigd)} note={`n=${ooitBevestigd}`} />
          </div>
        </StatCard>

        <StatCard label="BLOG GELEZEN, LAATSTE 30 DAGEN" stats={[
          { sublabel: 'PAGINA\'S GEOPEND', value: String(blogBezoeken), note: 'overzicht, artikelen en hashtagpagina\'s' },
          { sublabel: 'KLIKKEN OP START GRATIS', value: String(blogKlikken), note: blogBezoeken > 0 ? `${pct(blogKlikken, blogBezoeken)}% van de geopende pagina's` : undefined },
        ]} footnote="Elke keer dat iemand een pagina van de blog opent telt als één, ook jijzelf. Start gratis is de oranje knop onder een artikel, waarmee iemand een account kan maken." />

        <StatCard label="VERZENDING" stats={[
          { sublabel: 'VANDAAG VERZONDEN', value: `${verzondenVandaag} van ${budget}`, warn: verzondenVandaag >= budget },
          { sublabel: 'IN DE WACHTRIJ', value: String(wachtrij), warn: wachtrij > 0 },
          { sublabel: 'MISLUKT', value: String(mislukt), warn: mislukt > 0 },
        ]} footnote="Het dagbudget houdt de gedeelde Resend-daglimiet vrij voor betalings- en trialmails. Wat niet past, gaat de volgende dag mee." />

        {heeftGroei && (
          <StatCard label="ABONNEES PER MAAND" full
            footnote="Laatste 12 maanden. Aanmeldingen zijn bevestigde aanmeldingen (de aanmelder klikte op de link in de mail). Afmeldingen zijn afmeldingen van eerder bevestigde abonnees. Wie zich na een afmelding opnieuw aanmeldt, telt in de afmeldingen niet meer mee.">
            <MaandGrafieken maanden={maandPunten} />
          </StatCard>
        )}
      </TileGrid>

      {perPost.length > 0 && (
        <>
          <SubHeading label={`PER ARTIKEL (LAATSTE ${RECENT_POSTS})`} />
          <StatCard label="ARTIKELEN" full footnote="Bezoeken en klikken over de laatste 30 dagen. Verzonden, in de wachtrij, mislukt, geopend en geklikt gaan over de mails naar abonnees (unieke abonnees, percentage van verzonden). Geopend en geklikt vullen zich zodra open- en kliktracking in Resend aanstaat.">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                <thead>
                  <tr>
                    <th style={head}>ARTIKEL</th>
                    <th style={head}>VERZONDEN</th>
                    <th style={head}>WACHTRIJ</th>
                    <th style={head}>MISLUKT</th>
                    <th style={head}>GEOPEND</th>
                    <th style={head}>GEKLIKT</th>
                    <th style={head}>BEZOEKEN</th>
                    <th style={head}>KLIKKEN</th>
                  </tr>
                </thead>
                <tbody>
                  {perPost.map(p => (
                    <tr key={p.id}>
                      <td style={cell}>
                        <a href={`/blog/${p.slug}`} target="_blank" rel="noopener noreferrer" style={{ color: '#f1f5f9', textDecoration: 'none', fontWeight: 700 }}>{p.title}</a>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                          {new Date(p.published_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' })}
                        </div>
                      </td>
                      <td style={cell}>{p.verzonden}</td>
                      <td style={{ ...cell, color: p.inWachtrij > 0 ? '#f59e0b' : '#f1f5f9' }}>{p.inWachtrij}</td>
                      <td style={{ ...cell, color: p.gefaald > 0 ? '#f59e0b' : '#f1f5f9' }}>{p.gefaald}</td>
                      <td style={cell}>{p.geopend}{p.verzonden > 0 && p.geopend > 0 ? <span style={{ color: '#6b7280', fontSize: 12 }}> ({pct(p.geopend, p.verzonden)}%)</span> : null}</td>
                      <td style={cell}>{p.geklikt}{p.verzonden > 0 && p.geklikt > 0 ? <span style={{ color: '#6b7280', fontSize: 12 }}> ({pct(p.geklikt, p.verzonden)}%)</span> : null}</td>
                      <td style={cell}>{p.bezoeken}</td>
                      <td style={cell}>{p.klikken}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </StatCard>
        </>
      )}

      {wieDoetWat.length > 0 && (
        <>
          <SubHeading label="WIE DOET WAT" />
          <StatCard label="ABONNEES MET ACTIVITEIT" full
            footnote="Gesorteerd op klikken, dan openen. Klikken zijn betrouwbaar. Openen wordt opgeblazen doordat Apple Mail en Gmail afbeeldingen zelf vooraf laden. De kolom Gebruiker laat zien of het adres al een ArnoBot-account heeft.">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                <thead>
                  <tr>
                    <th style={head}>NAAM</th>
                    <th style={head}>E-MAIL</th>
                    <th style={head}>GEKLIKT</th>
                    <th style={head}>GEOPEND</th>
                    <th style={head}>LAATSTE ACTIVITEIT</th>
                    <th style={head}>GEBRUIKER</th>
                  </tr>
                </thead>
                <tbody>
                  {wieDoetWat.map(a => (
                    <tr key={a.email}>
                      <td style={cell}>{a.naam || ''}</td>
                      <td style={{ ...cell, color: a.status === 'confirmed' ? '#f1f5f9' : '#6b7280' }}>{a.email}{a.status !== 'confirmed' ? ' (afgemeld)' : ''}</td>
                      <td style={{ ...cell, fontWeight: 700 }}>{a.geklikt}</td>
                      <td style={cell}>{a.geopend}</td>
                      <td style={cell}>
                        {a.laatste ? new Date(a.laatste).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }) : ''}
                      </td>
                      <td style={{ ...cell, color: a.isGebruiker ? '#6b7280' : '#f59e0b', fontWeight: a.isGebruiker ? 400 : 700 }}>{a.isGebruiker ? 'JA' : 'NEE'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </StatCard>
        </>
      )}

      {aanmeldingen.length > 0 && (
        <>
          <SubHeading label="AANMELDINGEN" />
          <StatCard label="AANMELDINGEN" full
            footnote="Nieuwste bovenaan. Wacht op bevestiging betekent dat de aanmelder de link in de mail nog niet heeft aangeklikt. De CSV bevat alle abonnees.">
            <AanmeldingenLijst initialRows={aanmeldingen} total={totaal} />
          </StatCard>
        </>
      )}
    </div>
  )
}
