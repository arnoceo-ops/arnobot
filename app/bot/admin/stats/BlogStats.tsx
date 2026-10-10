import { getBlogDb } from '@/lib/blog'
import { getDailyBlogMailBudget } from '@/lib/blogMail'
import { StatCard, TileGrid, SubHeading, RatioBar, TrendChart } from './StatsUi'

// Tabblad BLOG op /bot/admin/stats: abonnees, groei, verzending, bezoek en per artikel.
// Alles zijn exacte tellingen in de database (head-count), geen rijen ophalen en zelf tellen,
// zodat het ook bij een groot aantal abonnees en pageviews snel en juist blijft.
// Het bezoek komt uit de eigen anonieme tellers (arnobot_pageviews, arnobot_cta_clicks), de
// bron van waarheid voor deze pagina, naast PostHog.

const DAY = 86_400_000
const WEEKS = 8
const RECENT_POSTS = 5

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

  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const end = now - i * 7 * DAY
    return { label: new Date(end - 7 * DAY).toISOString().slice(0, 10), from: new Date(end - 7 * DAY).toISOString(), to: new Date(end).toISOString() }
  })

  const [
    totaal, bevestigd, wachtOpBevestiging, afgemeld, ooitBevestigd, afgemeldNaBevestiging,
    wachtrij, mislukt, verzondenVandaag, blogBezoeken, blogKlikken,
    { data: posts },
    nieuwPerWeek, afgemeldPerWeek,
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
    Promise.all(weeks.map(w => n(subs().gte('confirmed_at', w.from).lt('confirmed_at', w.to)))),
    Promise.all(weeks.map(w => n(subs().gte('unsubscribed_at', w.from).lt('unsubscribed_at', w.to)))),
  ])

  const recent = (posts ?? []) as { id: string; slug: string; title: string; published_at: string }[]
  const perPost = await Promise.all(recent.map(async p => {
    const path = `/blog/${p.slug}`
    const [verzonden, inWachtrij, gefaald, bezoeken, klikken] = await Promise.all([
      n(deliveries().eq('post_id', p.id).eq('status', 'sent')),
      n(deliveries().eq('post_id', p.id).eq('status', 'queued')),
      n(deliveries().eq('post_id', p.id).eq('status', 'failed')),
      n(views().eq('path', path)),
      n(clicks().eq('path', path)),
    ])
    return { ...p, verzonden, inWachtrij, gefaald, bezoeken, klikken }
  }))

  const nieuw: Record<string, number> = {}
  const weg: Record<string, number> = {}
  weeks.forEach((w, i) => { nieuw[w.label] = nieuwPerWeek[i]; weg[w.label] = afgemeldPerWeek[i] })

  return {
    totaal, bevestigd, wachtOpBevestiging, afgemeld, ooitBevestigd, afgemeldNaBevestiging,
    wachtrij, mislukt, verzondenVandaag, blogBezoeken, blogKlikken, perPost, nieuw, weg,
    budget: getDailyBlogMailBudget(),
    heeftGroei: nieuwPerWeek.some(x => x > 0) || afgemeldPerWeek.some(x => x > 0),
  }
}

export default async function BlogStats() {
  const {
    totaal, bevestigd, wachtOpBevestiging, afgemeld, ooitBevestigd, afgemeldNaBevestiging,
    wachtrij, mislukt, verzondenVandaag, blogBezoeken, blogKlikken, perPost, nieuw, weg, budget, heeftGroei,
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

        <StatCard label="BEZOEK, LAATSTE 30 DAGEN" stats={[
          { sublabel: 'BLOGBEZOEKEN', value: String(blogBezoeken) },
          { sublabel: 'KLIKKEN OP START GRATIS VANAF DE BLOG', value: String(blogKlikken), note: blogBezoeken > 0 ? `${pct(blogKlikken, blogBezoeken)}% van de bezoeken` : undefined },
        ]} footnote="Eigen anonieme tellers, inclusief je eigen bezoeken. Telt overzicht, artikelen en hashtagpagina's." />

        <StatCard label="VERZENDING" stats={[
          { sublabel: 'VANDAAG VERZONDEN', value: `${verzondenVandaag} van ${budget}`, warn: verzondenVandaag >= budget },
          { sublabel: 'IN DE WACHTRIJ', value: String(wachtrij), warn: wachtrij > 0 },
          { sublabel: 'MISLUKT', value: String(mislukt), warn: mislukt > 0 },
        ]} footnote="Het dagbudget houdt de gedeelde Resend-daglimiet vrij voor betalings- en trialmails. Wat niet past, gaat de volgende dag mee." />

        {heeftGroei && (
          <StatCard label="GROEI PER WEEK" span={2} footnote="Per periode van 7 dagen, gerekend vanaf het begin van de periode. Bovenaan de laatste week.">
            <p style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 2, color: '#6b7280', marginBottom: 8 }}>NIEUWE BEVESTIGDE ABONNEES</p>
            <TrendChart data={nieuw} limit={WEEKS} />
            <p style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 2, color: '#6b7280', margin: '20px 0 8px' }}>AFMELDINGEN</p>
            <TrendChart data={weg} limit={WEEKS} />
          </StatCard>
        )}
      </TileGrid>

      {perPost.length > 0 && (
        <>
          <SubHeading label={`PER ARTIKEL (LAATSTE ${RECENT_POSTS})`} />
          <StatCard label="ARTIKELEN" full footnote="Bezoeken en klikken over de laatste 30 dagen. Verzonden, in de wachtrij en mislukt gaan over de mails naar abonnees.">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                <thead>
                  <tr>
                    <th style={head}>ARTIKEL</th>
                    <th style={head}>VERZONDEN</th>
                    <th style={head}>WACHTRIJ</th>
                    <th style={head}>MISLUKT</th>
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
    </div>
  )
}
