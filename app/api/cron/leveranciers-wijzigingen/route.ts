import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { notifyCronFailure, notifyTelegram } from '@/lib/cron-notify'
import {
  PAGINAS,
  MIN_TEKENS,
  MAX_OPGESLAGEN_TEKENS,
  MELD_FOUT_NA,
  schoonTekst,
  hashTekst,
  bepaalVerschil,
  verschilAlsTekst,
  type LeverancierPagina,
} from '@/lib/leveranciersPaginas'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const client = new Anthropic()

const TABEL = 'arnobot_leveranciers_paginas'
const FETCH_TIMEOUT_MS = 20_000

const STIJLREGELS = `Gebruik NOOIT markdown-opmaak zoals **tekst** of *tekst*. Schrijf platte tekst.
Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Herschrijf zinnen zonder streepjes.
Spreek de gebruiker ALTIJD aan met "jij" en "jou". Nooit "u". Ongeacht hoe senior of formeel de persoon is die je speelt.
Schrijf de actie zonder tijdslimiet: geen "vandaag", "morgen", "deze week", "voor het weekend". Gewoon de actie zelf.`

const SYSTEEM_DPA = `Je krijgt het verschil tussen twee versies van de verwerkersovereenkomst (DPA) van een leverancier van ArnoBot, een AI salescoach.
Beoordeel of er een inhoudelijke wijziging is: een nieuwe of aangepaste clausule, andere sub-verwerkers, andere bewaartermijnen, andere regio of doorgifte, andere meldtermijnen, een nieuwe versie of ingangsdatum. Verschillen die alleen opmaak, navigatie, tellers of kleine taalverbeteringen zijn tellen niet.
Antwoord met alleen JSON: {"melden":true,"samenvatting":"..."} of {"melden":false,"samenvatting":""}.
De samenvatting is maximaal 5 korte zinnen: wat is er veranderd en wat moet jij nakijken (bijvoorbeeld de privacypagina of de eigen DPA-documentatie).
${STIJLREGELS}`

const SYSTEEM_DEPRECATIONS = `Je krijgt het verschil tussen twee versies van een deprecations-, modellen- of prijzenpagina van een leverancier van ArnoBot.
ArnoBot gebruikt deze modellen: claude-sonnet-4-6, claude-haiku-4-5, claude-fable-5-1, claude-opus-5, claude-sonnet-5 (Anthropic), gpt-transcribe, gpt-live-transcribe, whisper-1, gpt-4o-transcribe (OpenAI), voyage-3-large, voyage-multilingual-2, rerank-2.5 (Voyage).
Meld alleen als een van die modellen of hun API een nieuwe of gewijzigde deprecation, pensioendatum, einddatum of prijswijziging krijgt, of als er een duidelijk nieuwere generatie van dezelfde soort bijkomt. Andere modellen, opmaak, navigatie en tellers tellen niet.
Antwoord met alleen JSON: {"melden":true,"samenvatting":"..."} of {"melden":false,"samenvatting":""}.
De samenvatting is maximaal 5 korte zinnen: welk model, welke datum, wat betekent dat voor ArnoBot.
${STIJLREGELS}`

interface Beoordeling {
  melden: boolean
  samenvatting: string
}

async function beoordeel(pagina: LeverancierPagina, verschil: string): Promise<Beoordeling | null> {
  const system = pagina.categorie === 'dpa' ? SYSTEEM_DPA : SYSTEEM_DEPRECATIONS
  // Retry-bij-leeg: een leeg antwoord mag niet stil als "geen wijziging" gelezen worden.
  for (let poging = 0; poging < 2; poging++) {
    try {
      const res = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        system,
        messages: [{ role: 'user', content: `<verschil pagina="${pagina.label}">\n${verschil}\n</verschil>\nBeoordeel dit verschil volgens de opdracht.` }],
      })
      const block = res.content.find(b => b.type === 'text')
      const tekst = block && block.type === 'text' ? block.text : ''
      const match = tekst.match(/\{[\s\S]*\}/)
      if (!match) continue
      const parsed = JSON.parse(match[0]) as { melden?: unknown; samenvatting?: unknown }
      if (typeof parsed.melden !== 'boolean') continue
      return { melden: parsed.melden, samenvatting: typeof parsed.samenvatting === 'string' ? parsed.samenvatting : '' }
    } catch {
      continue
    }
  }
  return null
}

interface Opgehaald {
  tekst: string | null
  hash: string
}

async function haalOp(pagina: LeverancierPagina): Promise<Opgehaald> {
  const res = await fetch(pagina.url, {
    headers: {
      'User-Agent': 'ArnoBot-leveranciersbewaking (+https://www.arno.bot)',
      Accept: pagina.pdf ? 'application/pdf' : 'text/html,application/xhtml+xml',
      'Accept-Language': 'en',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  if (pagina.pdf) {
    const bytes = Buffer.from(await res.arrayBuffer())
    if (bytes.length < 1000) throw new Error('PDF te klein of leeg')
    return { tekst: null, hash: hashTekst(bytes.toString('base64')) }
  }
  const tekst = schoonTekst(await res.text())
  if (tekst.length < MIN_TEKENS) throw new Error(`Te weinig tekst (${tekst.length} tekens), pagina laadt mogelijk met JavaScript of blokkeert de aanvraag`)
  return { tekst: tekst.slice(0, MAX_OPGESLAGEN_TEKENS), hash: hashTekst(tekst) }
}

interface Rij {
  url: string
  tekst: string | null
  hash: string | null
  fouten_op_rij: number
  fout_gemeld: boolean
}

// Wekelijkse controle (maandag 06:50 UTC) op de DPA's en deprecations-pagina's van leveranciers die niet
// in VisualPing staan. Eerste run legt alleen de basis vast. Meldt via Telegram bij een inhoudelijke
// wijziging (Sonnet beoordeelt het verschil) en na 3 mislukte pogingen achter elkaar.
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data: rijen, error } = await supabase.from(TABEL).select('url, tekst, hash, fouten_op_rij, fout_gemeld')
    if (error) throw new Error(error.message)
    const bestaand = new Map<string, Rij>((rijen ?? []).map(r => [r.url, r as Rij]))

    const meldingen: string[] = []
    const nieuweBasis: string[] = []
    const mislukt: string[] = []
    const nu = new Date().toISOString()

    for (const pagina of PAGINAS) {
      const rij = bestaand.get(pagina.url)
      try {
        const nieuw = await haalOp(pagina)

        if (!rij || rij.hash === null) {
          const { error: e } = await supabase.from(TABEL).upsert({
            url: pagina.url, label: pagina.label, categorie: pagina.categorie,
            tekst: nieuw.tekst, hash: nieuw.hash, laatst_gecontroleerd: nu,
            fouten_op_rij: 0, fout_gemeld: false,
          })
          if (e) throw new Error(e.message)
          nieuweBasis.push(pagina.label)
          continue
        }

        if (rij.hash === nieuw.hash) {
          await supabase.from(TABEL).update({ laatst_gecontroleerd: nu, fouten_op_rij: 0, fout_gemeld: false }).eq('url', pagina.url)
          continue
        }

        // De tekst is veranderd. Eerst vastleggen, dan beoordelen: een mislukte beoordeling mag de wijziging
        // niet bij de volgende run opnieuw laten verschijnen als "geen wijziging".
        let bericht: string | null = null
        if (nieuw.tekst === null || rij.tekst === null) {
          bericht = `${pagina.label}: het bestand is gewijzigd. Dit is een PDF, dus geen samenvatting. Lees de nieuwe versie zelf door.\n${pagina.url}`
        } else {
          const verschil = bepaalVerschil(rij.tekst, nieuw.tekst)
          if (verschil.toegevoegd.length === 0 && verschil.verwijderd.length === 0) {
            // Alleen volgorde of dubbele regels, geen inhoud.
          } else {
            const beoordeling = await beoordeel(pagina, verschilAlsTekst(verschil))
            if (beoordeling === null) {
              bericht = `${pagina.label}: de tekst is gewijzigd, maar de samenvatting is mislukt. Bekijk de pagina zelf.\n${pagina.url}`
            } else if (beoordeling.melden) {
              bericht = `${pagina.label}: wijziging gevonden\n\n${beoordeling.samenvatting}\n\n${pagina.url}`
            }
          }
        }
        const { error: e } = await supabase.from(TABEL).update({
          tekst: nieuw.tekst, hash: nieuw.hash, laatst_gecontroleerd: nu,
          laatst_gewijzigd: nu,
          fouten_op_rij: 0, fout_gemeld: false,
        }).eq('url', pagina.url)
        if (e) throw new Error(e.message)
        if (bericht) meldingen.push(bericht)
      } catch (err) {
        const reden = err instanceof Error ? err.message : String(err)
        const fouten = (rij?.fouten_op_rij ?? 0) + 1
        const moetMelden = fouten >= MELD_FOUT_NA && !(rij?.fout_gemeld ?? false)
        await supabase.from(TABEL).upsert({
          url: pagina.url, label: pagina.label, categorie: pagina.categorie,
          fouten_op_rij: fouten, fout_gemeld: moetMelden || (rij?.fout_gemeld ?? false), laatst_gecontroleerd: nu,
        })
        if (moetMelden) mislukt.push(`${pagina.label}: ${fouten} weken achter elkaar niet te controleren (${reden})\n${pagina.url}`)
      }
    }

    const berichten = [...meldingen, ...mislukt.map(m => `Leveranciersbewaking: ${m}`)]
    if (nieuweBasis.length > 0) {
      berichten.push(`Leveranciersbewaking: basis vastgelegd voor ${nieuweBasis.length} pagina's (${nieuweBasis.join(', ')}). Vanaf de volgende controle volgen meldingen bij wijzigingen.`)
    }
    for (const b of berichten) await notifyTelegram(b.slice(0, 3800))

    return NextResponse.json({ ok: true, wijzigingen: meldingen.length, nieuweBasis: nieuweBasis.length, mislukt: mislukt.length })
  } catch (err) {
    await notifyCronFailure('leveranciers-wijzigingen', err)
    return NextResponse.json({ error: 'Controle mislukt' }, { status: 500 })
  }
}
