import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { notifyCronFailure, notifyTelegram } from '@/lib/cron-notify'
import { excludeInternalTestUsers } from '@/lib/internalTestAccounts'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const client = new Anthropic()

// Vragen van de afgelopen 24 uur over het gebruik van ArnoBot zelf (knoppen, functies, abonnement,
// account), niet over sales of business. Eén Telegram-bericht per dag, en alleen als er iets is.
const VENSTER_MS = 24 * 60 * 60 * 1000
const MAX_VRAGEN = 1000
const CHUNK = 150
const MAX_TEKENS_PER_VRAAG = 400
const MAX_IN_BERICHT = 30
const MAX_TEKENS_IN_BERICHT = 100
// De client zet bij de eerste vraag van een sessie deze context voor de vraag (SparClient.tsx).
const ACTIE_PREFIX = /^\[Actieopvolging vorige sessie:[\s\S]*?\]\s*/

const SYSTEEM = `Je krijgt genummerde vragen die gebruikers aan ArnoBot stelden, een AI salescoach voor sales managers.
Kies alles wat mogelijk over de app zelf gaat: hoe een knop of functie werkt, wat een functie doet, hoe iets te vinden of te gebruiken is, abonnement of account, de vraag of ArnoBot iets kan (bijvoorbeeld een link of bestand lezen, een document maken of herschrijven), en elke wens of elk idee voor een functie.
Bij twijfel kies je de vraag. Liever te veel dan iets missen.
Gewone vragen over sales, leiderschap of coaching zonder verband met wat ArnoBot kan of doet horen er niet bij.
Antwoord met alleen JSON in dit formaat: {"nummers":[1,5]}. Geen toelichting. Is er geen enkele, antwoord dan {"nummers":[]}.
Gebruik NOOIT markdown-opmaak zoals **tekst** of *tekst*. Schrijf platte tekst.
Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Herschrijf zinnen zonder streepjes.`

async function kiesProductvragen(vragen: string[]): Promise<number[]> {
  const lijst = vragen.map((v, i) => `${i + 1}. ${v}`).join('\n')
  // Retry-bij-leeg: een leeg antwoord mag niet stil als "geen productvragen" gelezen worden.
  for (let poging = 0; poging < 2; poging++) {
    const res = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: SYSTEEM,
      messages: [{ role: 'user', content: lijst }],
    })
    const block = res.content.find(b => b.type === 'text')
    const tekst = block && block.type === 'text' ? block.text : ''
    const match = tekst.match(/\{[\s\S]*\}/)
    if (!match) continue
    try {
      const parsed = JSON.parse(match[0]) as { nummers?: unknown }
      if (!Array.isArray(parsed.nummers)) continue
      return parsed.nummers.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= vragen.length)
    } catch {
      continue
    }
  }
  throw new Error('Geen geldig antwoord van het model bij het beoordelen van de vragen')
}

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sinds = new Date(Date.now() - VENSTER_MS).toISOString()
    const { data: logs, error } = await excludeInternalTestUsers(
      supabase
        .from('arnobot_rds_logs')
        .select('user_id, question')
        .gte('created_at', sinds)
    )
      .order('created_at', { ascending: true })
      .limit(MAX_VRAGEN)
    if (error) throw error

    const items = (logs ?? [])
      .map(l => ({
        userId: typeof l.user_id === 'string' ? l.user_id : '',
        vraag: (typeof l.question === 'string' ? l.question.replace(ACTIE_PREFIX, '').trim() : '').slice(0, MAX_TEKENS_PER_VRAAG),
      }))
      .filter(x => x.vraag.length > 0)

    if (items.length === 0) return NextResponse.json({ ok: true, productvragen: 0 })

    const gevonden: { userId: string; vraag: string }[] = []
    for (let i = 0; i < items.length; i += CHUNK) {
      const chunk = items.slice(i, i + CHUNK)
      const nummers = await kiesProductvragen(chunk.map(c => c.vraag))
      for (const n of nummers) gevonden.push(chunk[n - 1])
    }

    if (gevonden.length === 0) return NextResponse.json({ ok: true, productvragen: 0 })

    // Naam per gebruiker, alleen voor de gevonden vragen (maximaal MAX_IN_BERICHT in het bericht).
    const getoond = gevonden.slice(0, MAX_IN_BERICHT)
    const ids = [...new Set(getoond.map(g => g.userId).filter(Boolean))]
    const naamPerId = new Map<string, string>()
    if (ids.length > 0) {
      const { data: users } = await supabase
        .from('approved_users')
        .select('user_id, voornaam, achternaam')
        .in('user_id', ids)
      for (const u of users ?? []) {
        naamPerId.set(u.user_id, u.voornaam || u.achternaam || 'Onbekend')
      }
    }

    const datum = new Date().toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'long' })
    const kort = (v: string) => {
      const plat = v.replace(/\s+/g, ' ')
      return plat.length > MAX_TEKENS_IN_BERICHT ? `${plat.slice(0, MAX_TEKENS_IN_BERICHT).trimEnd()}…` : plat
    }
    const regels = getoond.map(g => `${naamPerId.get(g.userId) ?? 'Onbekend'}: ${kort(g.vraag)}`)
    const rest = gevonden.length > MAX_IN_BERICHT ? `\nEn nog ${gevonden.length - MAX_IN_BERICHT}.` : ''
    await notifyTelegram(`ARNOBOT PRODUCTVRAGEN · ${datum}\n${regels.join('\n')}${rest}`)

    return NextResponse.json({ ok: true, productvragen: gevonden.length })
  } catch (err) {
    await notifyCronFailure('productvragen', err)
    return NextResponse.json({ error: 'Cron mislukt' }, { status: 500 })
  }
}
