import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { getText } from '@/lib/ai'
import { notifyCronFailure } from '@/lib/cron-notify'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {

  // Haal alle sessies op van alle gebruikers (max 300 voor context)
  const { data: sessions } = await supabase
    .from('arnobot_blog_sessions')
    .select('title, summary')
    .order('created_at', { ascending: false })
    .limit(300)

  // Haal recente analyses op (max 50)
  const { data: analyses } = await supabase
    .from('arnobot_analyses')
    .select('analyse_text')
    .order('created_at', { ascending: false })
    .limit(50)

  const sessiesText = (sessions ?? [])
    .filter(s => s.title || s.summary)
    .map(s => `- ${s.title ?? ''}${s.summary ? `: ${s.summary.slice(0, 120)}` : ''}`)
    .join('\n')

  const analysesText = (analyses ?? [])
    .filter(a => a.analyse_text)
    .map(a => a.analyse_text.slice(0, 200))
    .join('\n---\n')

  const prompt = `Je bent Arno Diepeveen. Analyseer de onderstaande gesprekken en analyses van ArnoBot-gebruikers en identificeer de meest voorkomende patronen, struggles en thema's.

Genereer op basis hiervan 10 nieuwe voorgeformuleerde vragen per categorie. De vragen moeten:
- Concreet zijn, direct, in Arno's stem. Geen vage open deuren.
- Gebaseerd op echte patronen uit de data
- In het Nederlands, eerste persoon of directe aanspraakvorm
- Geen accenten op woorden voor nadruk

Zet de 10 vragen per categorie in aflopende volgorde van belangrijkheid: de vraag die het meest voorkomende of meest urgente patroon raakt eerst, de minst urgente als laatste.

Geef de output als JSON in dit exacte formaat:
{
  "strategisch": ["vraag1", "vraag2", ..., "vraag10"],
  "organisatorisch": ["vraag1", "vraag2", ..., "vraag10"],
  "operationeel": ["vraag1", "vraag2", ..., "vraag10"]
}

Categorie-uitleg:
- strategisch: voor CEO/DGA en VP of Sales. Strategie, groei, marktpositie, commercieel model.
- organisatorisch: voor Sales Director. Team, recruitment, coaching, performance.
- operationeel: voor AE/AM/Inside Sales. Deals, pipeline, bezwaren, afsluiten, klantgesprekken.

GESPREKKEN (${(sessions ?? []).length} stuks):
${sessiesText}

ANALYSES:
${analysesText}`

  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = getText(res.content).trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end < 0) {
    return NextResponse.json({ error: 'Claude gaf geen geldige JSON terug', raw: text }, { status: 500 })
  }

  let parsed: { strategisch: string[]; organisatorisch: string[]; operationeel: string[] }
  try {
    parsed = JSON.parse(text.slice(start, end + 1))
  } catch {
    return NextResponse.json({ error: 'JSON parse mislukt', raw: text }, { status: 500 })
  }

  // Sla op — altijd één rij, overschrijf de vorige
  const { error } = await supabase
    .from('arnobot_openers')
    .upsert({
      id: '00000000-0000-0000-0000-000000000001',
      strategisch: parsed.strategisch ?? [],
      organisatorisch: parsed.organisatorisch ?? [],
      operationeel: parsed.operationeel ?? [],
    })

  if (error) {
    console.error('[cron/refresh-openers]', error.message)
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    counts: {
      strategisch: parsed.strategisch?.length ?? 0,
      organisatorisch: parsed.organisatorisch?.length ?? 0,
      operationeel: parsed.operationeel?.length ?? 0,
    },
    sessions_analysed: sessions?.length ?? 0,
    analyses_used: analyses?.length ?? 0,
  })
  } catch (err) {
    await notifyCronFailure('refresh-openers', err)
    return NextResponse.json({ error: 'cron_error' }, { status: 500 })
  }
}
