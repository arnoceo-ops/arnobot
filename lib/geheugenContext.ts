import type { SupabaseClient } from '@supabase/supabase-js'
import { embedSessionQuery } from '@/lib/rag'
import { findRecurringEntitiesInQuestion } from '@/lib/memoryEntities'
import { feitenRegels } from '@/lib/memoryLabels'
import { mailChatSignaal } from '@/lib/mailPatroon'

// Opbouw van het gespreksgeheugen en de gebruikerscontext voor de hoofdchat. Stond in
// app/api/chat/route.ts; hierheen verplaatst zodat de route en de testroute
// (app/api/admin/geheugen-preview) EXACT dezelfde code draaien en het geheugen op echte data
// gecontroleerd kan worden zonder een kopie van de logica te testen (2026-10-31).

// Sparsessies tellen niet standaard mee in het geheugen van gewone gesprekken (dat zou dit
// al kwetsbare, complexiteitsgevoelige endpoint verder belasten voor alle gebruikers, ook wie
// nooit spart). Alleen wanneer de gebruiker er zelf naar verwijst, wordt de sparring-historie
// (laatste 10, zelfde grens als bij de coachingssynthese) opgehaald voor dit ene bericht.
export function detectSparringReference(text: string): boolean {
  return /spar|oefengesprek/i.test(text)
}

// Aanvulling op de recency-laag hierboven/hieronder (laatste 10/25 sessies): vindt oudere
// sessies die buiten dat venster vallen maar semantisch relevant zijn voor de huidige vraag.
// Voor beide plannen, niet Pro-only (dit is een kwaliteitsfix op een laag die Basic al heeft,
// geen nieuwe premium-feature), maar Pro krijgt meer kandidaten, zelfde verhouding als de
// bestaande 10/25-split. Geen hard drempel-cutoff (dat faalde eerder bij de Bieb-zoekfunctie,
// zie geheugen), alleen een lage ondergrens om pure ruis niet als "relevant" te presenteren.
const SEMANTIC_MEMORY_CANDIDATES = 15
const SEMANTIC_MEMORY_MIN_SIMILARITY = 0.3
export const SEMANTIC_MEMORY_TOP_N = { basis: 3, overig: 8 } as const

// Datumlabel voor alles wat uit het sessiegeheugen in de prompt komt: dag, maand en jaar, bij
// recente herinneringen ook hoe lang geleden. Zonder datum zag het model feiten van maanden terug
// als de huidige stand van zaken (2026-10-31, testgebruikersincident: een traject dat intussen on hold
// stond werd als actueel behandeld). Bij oudere herinneringen bewust GEEN "x maanden geleden":
// met dat label verzon het model in 8 van 8 testruns "vier jaar geleden". Alleen de datum, het
// model rekent zelf vanaf "VANDAAG IS" (chat-route, profielContext).
export function geheugenDatum(iso: string): string {
  const d = new Date(iso)
  const dagen = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000))
  const datum = d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
  if (dagen >= 70) return datum
  const geleden = dagen < 14 ? `${dagen} dag${dagen === 1 ? '' : 'en'} geleden` : `${Math.round(dagen / 7)} weken geleden`
  return `${datum}, ${geleden}`
}

// Herinneringen ouder dan 6 weken komen niet meer als situatiefeiten de prompt in, alleen als
// neutraal onderwerp en blijvende feiten (lib/memoryLabels.ts). Zie de replay-meting van 2026-10-31.
export const OUD_GEHEUGEN_MS = 42 * 24 * 60 * 60 * 1000
export function isOudGeheugen(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() > OUD_GEHEUGEN_MS
}
export function geheugenOnderwerp(s: { onderwerp?: string | null; title?: string | null }): string {
  return (s.onderwerp || String(s.title ?? '').slice(0, 60) || 'gesprek').trim()
}

export type OudereSessie = { session_id: string; title: string | null; summary: string | null; feiten: string | null; onderwerp: string | null; created_at: string }

export async function findSemanticallyRelevantOlderSessions(
  supabase: SupabaseClient,
  targetUserId: string,
  currentSessionId: string,
  vraag: string,
  negeerSessieIds: string[] = [],
): Promise<OudereSessie[]> {
  try {
    const queryEmbedding = await embedSessionQuery(vraag)
    const { data: matches, error } = await supabase.rpc('match_sessions', {
      query_embedding: queryEmbedding,
      match_user_id: targetUserId,
      match_count: SEMANTIC_MEMORY_CANDIDATES,
    })
    if (error) {
      console.error('[chat] match_sessions RPC-fout:', error.message)
      return []
    }
    const candidateIds = ((matches ?? []) as { session_id: string; similarity: number }[])
      .filter(m => m.session_id !== currentSessionId && !negeerSessieIds.includes(m.session_id) && m.similarity >= SEMANTIC_MEMORY_MIN_SIMILARITY)
      .map(m => m.session_id)
    if (candidateIds.length === 0) return []

    // match_sessions filtert niet op deleted_at (bevestigd 2026-08-12, zie geheugen), dus hier
    // alsnog uitsluiten: anders komt soft-deleted content (bijv. Basic-gebruikers boven de
    // 25-sessie-grens) terug in het geheugen terwijl die voor de gebruiker verwijderd is.
    const { data: validRows } = await supabase
      .from('arnobot_blog_sessions')
      .select('session_id, title, summary, feiten, onderwerp, created_at')
      .in('session_id', candidateIds)
      .is('deleted_at', null)
      .eq('community_excluded', false)
    if (!validRows?.length) return []

    const similarityOrder = new Map(candidateIds.map((id, i) => [id, i]))
    return [...validRows].sort(
      (a, b) => (similarityOrder.get(a.session_id) ?? 0) - (similarityOrder.get(b.session_id) ?? 0)
    )
  } catch (e) {
    console.error('[chat] semantische geheugenretrieval mislukt:', e)
    return []
  }
}

export type GeheugenContext = { geheugentekst: string; prevSessionCount: number; verouderd: boolean }

export async function haalGeheugenContext(
  supabase: SupabaseClient,
  p: {
    userId: string
    sessionId: string
    question: string
    history: { role: string; content: string }[] | undefined
    plan: 'basis' | 'premium' | 'team'
    // Alleen voor de testroute (admin/geheugen-preview): sessies die het geheugen moet negeren, om een
    // eerder moment na te spelen zonder dat gesprekken van daarna al meetellen. De chatroute geeft dit nooit mee.
    negeerSessieIds?: string[]
  },
): Promise<GeheugenContext> {
  const { userId, sessionId, question, history, plan } = p
  const negeer = p.negeerSessieIds ?? []
  let recenteQuery = supabase
    .from('arnobot_blog_sessions')
    .select('session_id, title, summary, feiten, onderwerp, feiten_blijvend, mail_verzoek, uitdaging, actie_status, created_at')
    .eq('user_id', userId)
    .not('session_id', 'eq', sessionId)
  for (const id of negeer) recenteQuery = recenteQuery.not('session_id', 'eq', id)
  return Promise.all([
          recenteQuery
            .is('deleted_at', null)
            .eq('community_excluded', false)
            .order('created_at', { ascending: false })
            .limit(plan !== 'basis' ? 25 : 10),
          detectSparringReference(question)
            ? supabase
                .from('arnobot_sparring_sessions')
                .select('persona, debrief, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(10)
            : Promise.resolve({ data: null as { persona: string | null; debrief: string | null; created_at: string }[] | null }),
          findSemanticallyRelevantOlderSessions(supabase, userId, sessionId, question, negeer),
          findRecurringEntitiesInQuestion(userId, question),
          supabase
            .from('arnobot_coaching')
            .select('mindset_diagnose, ontwikkelpunten, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          // Tijdstip van het vorige bericht in dit gesprek: bij een hervat gesprek van weken of
          // maanden terug is de meegestuurde geschiedenis geen actuele stand van zaken meer.
          Array.isArray(history) && history.length > 0
            ? supabase
                .from('arnobot_rds_logs')
                .select('created_at')
                .eq('user_id', userId)
                .eq('session_id', sessionId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()
            : Promise.resolve({ data: null as { created_at: string } | null }),
        ])
          .then(async ([{ data: prevSessions }, { data: sparringSessions }, oudereKandidaten, terugkerendeEntiteiten, { data: laatsteCoaching }, { data: laatsteBericht }]) => {
            let geheugentekst = ''
            let prevSessionCount = 0
            if (prevSessions && prevSessions.length > 0) {
              prevSessionCount = prevSessions.length
              // Herinneringen ouder dan 6 weken staan in een eigen blok dat zichzelf als vaak
              // achterhaald markeert. Samen met de recente feiten in één lijst behandelde het model ze
              // als de huidige stand van zaken (replay testgebruikersincident, 2026-10-31).
              const recenteSessies = prevSessions.filter(s => !isOudGeheugen(s.created_at))
              const oudeSessies = prevSessions.filter(s => isOudGeheugen(s.created_at))
              const feitenBlokken = recenteSessies.filter(s => s.feiten).map(s => `[${geheugenDatum(s.created_at)}]\n${s.feiten}`).join('\n\n')
              const samenvattingen = recenteSessies.filter(s => s.summary).map(s => {
                const datum = geheugenDatum(s.created_at)
                return `- ${datum}: ${s.summary}`
              }).join('\n')
              const blijvendeFeiten = [...new Set(oudeSessies.flatMap(s => feitenRegels(s.feiten_blijvend)))]
              const oudeOnderwerpen = oudeSessies
                .map(s => `- ${geheugenDatum(s.created_at)}: ${geheugenOnderwerp(s)}`)
                .join('\n')
              const uitdagingSessies = prevSessions.filter(s => s.uitdaging)
              const recentSessieMetUitdaging = uitdagingSessies[0] ?? null
              const recentUitdaging = recentSessieMetUitdaging?.uitdaging ?? null
              const recentActieStatus = recentSessieMetUitdaging?.actie_status ?? null
              // Openstaande acties: alles met een uitdaging waar de gebruiker niet "ja, gedaan"
              // of "skip" op heeft geantwoord. Max 3, meest recent eerst. Vroeger werd alleen de
              // allerlaatste uitdaging doorgegeven, waardoor oudere niet-afgehandelde acties
              // stilzwijgend verdwenen zodra er een nieuwere bijkwam (meta-analyse wortel 3).
              const openActies = uitdagingSessies
                .filter(s => s.actie_status !== 'ja' && s.actie_status !== 'skip')
                .slice(0, 3)
              if (feitenBlokken || samenvattingen || oudeOnderwerpen || recentUitdaging) {
                geheugentekst = '\n\nWAT DEZE GEBRUIKER EERDER HEEFT GEDEELD (elk blok heeft een datum, vandaag staat bovenaan):\nDit is geheugen, geen actuele stand van zaken. Wat de gebruiker in dit gesprek zegt wint altijd van het geheugen. Is iets langer dan een paar weken geleden, behandel het dan als een herinnering ("in juli vertelde je dat...") en toets met één korte vraag of het nog klopt voordat je er een oordeel of advies op bouwt. De tekst die de gebruiker nu geeft beoordeel je gerust direct. Conclusies over de situatie eromheen (de stand van een klantrelatie, een traject of een afspraak) bouw je alleen op wat de gebruiker nu zegt. Noem tijdsaanduidingen alleen zoals ze hier staan, reken of schat nooit zelf, en zeg nooit dat je iets eerder hebt geadviseerd tenzij dat letterlijk in dit gesprek staat. Noem geen toekomstige momenten of afspraken (zoals "het gesprek van morgen") tenzij de gebruiker ze in dit gesprek zelf noemt.'
                if (feitenBlokken) geheugentekst += `\n\nConcrete feiten uit eerdere gesprekken:\n${feitenBlokken}`
                if (samenvattingen) geheugentekst += `\n\nSamenvattingen van eerdere gesprekken:\n${samenvattingen}`
                if (blijvendeFeiten.length > 0) geheugentekst += `\n\nBLIJVENDE FEITEN UIT OUDERE GESPREKKEN (veranderen zelden, deze mag je als feit gebruiken):\n${blijvendeFeiten.map(f => `- ${f}`).join('\n')}`
                if (oudeOnderwerpen) geheugentekst += `\n\nOUDE ONDERWERPEN (meer dan 6 weken geleden, de stand van zaken is onbekend):\nGebruik ze alleen om een vraag te stellen ("hoe staat dat er nu voor?"), nooit om iets over de huidige situatie te beweren.\n${oudeOnderwerpen}`
                if (recentUitdaging) {
                  const statusTekst = recentActieStatus === 'ja'
                    ? 'De gebruiker heeft aangegeven dit gedaan te hebben. Transparantie is een kernwaarde van Arno. Als iets in dit gesprek duidelijk niet klopt met dat antwoord, benoem het direct. Geen aannames over de reden want de volledige context is niet altijd zichtbaar. Het feit zelf benoemen is geen aanname. Sluit af met een open vraag: "Wat speelt er bij je?" Arno doet dit niet om te controleren maar omdat zijn enige drive is dat de gebruiker beter presteert en succesvol wordt. Dat is de toon: eerlijk en direct vanuit oprechte betrokkenheid.'
                    : recentActieStatus === 'deels'
                    ? 'De gebruiker heeft aangegeven dit ingepland te hebben maar nog niet volledig gedaan.'
                    : recentActieStatus === 'nee'
                    ? 'De gebruiker heeft aangegeven dit nog niet gedaan te hebben.'
                    : 'De gebruiker heeft hier nog geen antwoord op gegeven.'
                  geheugentekst += `\n\nActie uit vorig gesprek (zie de instructie OPENSTAANDE ACTIES EERST voor hoe je dit gebruikt):\n${recentUitdaging}\n${statusTekst}`
                }
                const extraOpen = openActies.filter(s => s.session_id !== recentSessieMetUitdaging?.session_id)
                if (extraOpen.length > 0) {
                  const lijst = extraOpen.map(s => {
                    const datum = geheugenDatum(s.created_at)
                    const st = s.actie_status === 'deels' ? 'deels gedaan' : s.actie_status === 'nee' ? 'nog niet gedaan' : 'geen antwoord gegeven'
                    return `- ${datum}: ${s.uitdaging} (${st})`
                  }).join('\n')
                  geheugentekst += `\n\nEr staan nog meer acties open uit eerdere gesprekken. Pak alleen op wat bij de huidige vraag past, noem de rest hooguit kort:\n${lijst}`
                }
              }
            }
            const relevanteSparring = (sparringSessions ?? []).filter(s => s.debrief)
            if (relevanteSparring.length > 0) {
              const sparringTekst = relevanteSparring.map(s => {
                const datum = geheugenDatum(s.created_at)
                return `- ${datum} (rol: ${s.persona ?? 'onbekend'}):\n${s.debrief}`
              }).join('\n\n')
              geheugentekst += `\n\nSPARRING-OEFENSESSIES VAN DEZE GEBRUIKER (laatste ${relevanteSparring.length}, alleen relevant omdat de gebruiker er zelf naar verwijst):\n${sparringTekst}`
            }
            const recentSessionIds = new Set((prevSessions ?? []).map(s => s.session_id))
            const semantischeTopN = plan !== 'basis' ? SEMANTIC_MEMORY_TOP_N.overig : SEMANTIC_MEMORY_TOP_N.basis
            const relevanteOudereSessies = oudereKandidaten
              .filter(s => !recentSessionIds.has(s.session_id))
              .slice(0, semantischeTopN)
            if (relevanteOudereSessies.length > 0) {
              const oudereTekst = relevanteOudereSessies.map(s => {
                const datum = geheugenDatum(s.created_at)
                // Oud: alleen het onderwerp (de stand van zaken is onbekend), recent: volledige inhoud.
                const inhoud = isOudGeheugen(s.created_at)
                  ? `${geheugenOnderwerp(s)} (stand van zaken onbekend, alleen als vraag gebruiken)`
                  : [s.summary, s.feiten].filter(Boolean).join(' ')
                return `- ${datum}: ${inhoud}`
              }).join('\n')
              geheugentekst += `\n\nMOGELIJK RELEVANTE OUDERE GESPREKKEN (buiten de recente geschiedenis hierboven, gevonden op basis van de huidige vraag, gebruik alleen als het echt aansluit):\n${oudereTekst}`
            }
            if (terugkerendeEntiteiten.length > 0) {
              const entiteitenTekst = terugkerendeEntiteiten.map(e => {
                const datum = new Date(e.last_mentioned_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })
                return `- ${e.entity_name}${e.entity_type ? ` (${e.entity_type})` : ''}: eerder genoemd in ${e.mention_count} gesprek${e.mention_count === 1 ? '' : 'ken'}, laatst op ${datum}`
              }).join('\n')
              geheugentekst += `\n\nTERUGKERENDE NAMEN/THEMA'S IN DEZE VRAAG (patroon over meerdere gesprekken heen, gebruik alleen als het de vraag versterkt):\n${entiteitenTekst}`
            }
            if (laatsteCoaching?.mindset_diagnose) {
              const mindsetOntwikkelpunten = ((laatsteCoaching.ontwikkelpunten as { tekst: string; pijlar: string }[] | null) ?? [])
                .filter(p => p.pijlar === 'mindset')
              const datum = new Date(laatsteCoaching.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })
              geheugentekst += `\n\nMINDSET-SIGNAAL UIT LAATSTE COACHINGSDOCUMENT (${datum}, zie de instructie bij OPENSTAANDE ACTIES EERST voor hoe je dit gebruikt):\n${laatsteCoaching.mindset_diagnose}`
              if (mindsetOntwikkelpunten.length > 0) {
                geheugentekst += `\nOntwikkelpunt(en) mindset: ${mindsetOntwikkelpunten.map(p => p.tekst).join(' | ')}`
              }
            }
            // Verouderd gesprek (laatste bericht langer dan 48 uur geleden, bv. via ?resume= of een
            // tab die dagen openstond): de oude berichten gaan NIET als live beurten mee, want dan
            // ankert het model erop en behandelt het ze als de actuele stand (bevestigd met een
            // replay van het testgesprek, 2026-10-31: de notitie alleen was niet genoeg). Ze gaan
            // als gedateerd, ingekort geheugen mee.
            // Mailpatroon: gebruikt de gebruiker ArnoBot vooral als tekstschrijver? (lib/mailPatroon.ts)
            const recenteGesprekken = prevSessions ?? []
            geheugentekst += mailChatSignaal(recenteGesprekken.filter(s => s.mail_verzoek === true).length, recenteGesprekken.length)
            let verouderd = false
            if (laatsteBericht && Array.isArray(history) && history.length > 0 && Date.now() - new Date(laatsteBericht.created_at).getTime() > 48 * 60 * 60 * 1000) {
              verouderd = true
              // Geen letterlijke berichten van toen: die komen als gespreksfragment over als "nu"
              // (replay-meting 2026-10-31). De samenvatting van de sessie, met datum, wel.
              const { data: dezeSessie } = await supabase
                .from('arnobot_blog_sessions')
                .select('title, onderwerp')
                .eq('user_id', userId)
                .eq('session_id', sessionId)
                .maybeSingle()
              // Alleen het neutrale onderwerp van toen: de samenvatting en feiten bevatten juist de
              // stand van zaken van toen, die het model als "nu" ging noemen.
              const inhoud = dezeSessie
                ? `Onderwerp van toen: ${geheugenOnderwerp(dezeSessie)}. Wat er toen speelde is mogelijk achterhaald, vraag hoe het er nu voor staat.`
                : String((history as { content: string }[]).filter((_, i) => i % 2 === 0).slice(-1)[0]?.content ?? '').slice(0, 300)
              geheugentekst += `\n\nEERDER DEEL VAN DIT GESPREK (laatste bericht ${geheugenDatum(laatsteBericht.created_at)}):\nDe gebruiker pakt een gesprek van toen weer op. Wat hieronder staat is een herinnering aan dat gesprek en geen actuele stand van zaken. Wat de gebruiker nu schrijft is leidend. Weet je niet of iets hieruit nog klopt, stel dan één korte vraag.\n${inhoud}`
            }
            return { geheugentekst, prevSessionCount, verouderd }
          })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function bouwProfielContext(profiel: any, voornaamGebruiker: string, nu: Date = new Date()): string {
    // Zonder de naam wist het model niet dat "Hoi Sanne" of "Met vriendelijke groet, Sanne" in een
    // geplakte mail de gebruiker zelf is en nam het aan dat het over iemand anders ging (2026-10-31).
    const naamContext = voornaamGebruiker
      ? `\nDE GEBRUIKER HEET ${voornaamGebruiker}. Staat die naam in een geplakte mail, brief of tekst als afzender of ontvanger, dan is dat de gebruiker zelf. Gebruik de naam niet als standaard aanhef.\n`
      : ''

    // Het model kent de datum van vandaag niet. Zonder die kon het "4 maanden geleden" in het
    // geheugen niet controleren en verzon het tijdsaanduidingen ("vier jaar geleden", "vorige week",
    // gemeten in de replay van 2026-10-31).
    const vandaagContext = `\nVANDAAG IS ${nu.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' })}. Reken tijdsverschillen met geheugen vanaf deze datum.\n`

    const profielContext = vandaagContext + naamContext + (profiel ? `
PROFIEL VAN DE GEBRUIKER:
- Rol: ${profiel.rol || 'onbekend'}
- Jaren in sales: ${profiel.jaren_sales || 'onbekend'}
- Jaren in huidige functie: ${profiel.jaren_functie || 'onbekend'}
- Markt: ${Array.isArray(profiel.markt) ? profiel.markt.join(', ') : profiel.markt || 'onbekend'}
- Wat hij/zij verkoopt: ${profiel.wat_verkoop_je || 'onbekend'}
- Ideale klant: ${profiel.ideale_klant || 'onbekend'}
- Grootste uitdaging: ${profiel.uitdaging || 'onbekend'}${profiel.dealgrootte ? `\n- Gemiddelde dealgrootte: ${profiel.dealgrootte}` : ''}${profiel.salescyclus ? `\n- Salescyclus: ${profiel.salescyclus}` : ''}${profiel.teamgrootte ? `\n- Salesteam grootte: ${profiel.teamgrootte}` : ''}${profiel.target_dit_jaar ? `\n- Verwacht team-/companytarget dit jaar te halen: ${profiel.target_dit_jaar}` : ''}${profiel.positionering ? `\n- Onderscheidend vermogen: ${profiel.positionering}` : ''}${Array.isArray(profiel.klantenbron) && profiel.klantenbron.length ? `\n- Klanten komen via: ${profiel.klantenbron.join(', ')}${profiel.kanaal_afhankelijkheid ? ` (${profiel.kanaal_afhankelijkheid})` : ''}` : ''}${profiel.acquisitie_tijd ? `\n- Tijd naar acquisitie: ${profiel.acquisitie_tijd}` : ''}
` : '')
  return profielContext
}
