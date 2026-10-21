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

const SYSTEEM = `Je krijgt genummerde vragen die gebruikers aan ArnoBot stelden, een AI salescoach voor sales managers.
Kies de vragen waarin de gebruiker iets wil weten over de app zelf: hoe een knop of functie werkt, wat een functie doet, hoe iets in de app te vinden of te gebruiken is, of een vraag over abonnement, account of de werking van ArnoBot.
Vragen over sales, leiderschap, coaching of andere inhoud van het werk van de gebruiker horen daar NIET bij.
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
        vraag: (typeof l.question === 'string' ? l.question.trim() : '').slice(0, MAX_TEKENS_PER_VRAAG),
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
        .select('user_id, voornaam, achternaam, email')
        .in('user_id', ids)
      for (const u of users ?? []) {
        naamPerId.set(u.user_id, [u.voornaam, u.achternaam].filter(Boolean).join(' ') || u.email || u.user_id)
      }
    }

    const datum = new Date().toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'long' })
    const regels = getoond.map((g, i) => `${i + 1}. ${naamPerId.get(g.userId) ?? 'Onbekend'}\n${g.vraag}`)
    const rest = gevonden.length > MAX_IN_BERICHT ? `\n\nEn nog ${gevonden.length - MAX_IN_BERICHT} andere.` : ''
    await notifyTelegram(`ARNOBOT PRODUCTVRAGEN · ${datum}\n\n${regels.join('\n\n')}${rest}`)

    return NextResponse.json({ ok: true, productvragen: gevonden.length })
  } catch (err) {
    await notifyCronFailure('productvragen', err)
    return NextResponse.json({ error: 'Cron mislukt' }, { status: 500 })
  }
}
