import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { excludeInternalTestUsers } from '@/lib/internalTestAccounts'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: logs } = await excludeInternalTestUsers(
    supabase
      .from('arnobot_rds_logs')
      .select('question, answer, created_at')
      .eq('feedback', 'neg')
  )
    .order('created_at', { ascending: false })
    .limit(20)

  if (!logs || logs.length === 0) {
    return NextResponse.json({ error: 'Geen negatieve beoordelingen gevonden' }, { status: 404 })
  }

  const content = logs.map((l: { question: string; answer: string; created_at: string }, i: number) =>
    `--- Gesprek ${i + 1} (${new Date(l.created_at).toLocaleDateString('nl-NL')}) ---\nVRAAG: ${l.question}\nARNO: ${l.answer}`
  ).join('\n\n')

  const client = new Anthropic()

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    system: `Je analyseert negatief beoordeelde antwoorden van ArnoBot, een AI salescoach voor sales managers.
Identificeer patronen: wat gaat er structureel fout? Welke typen vragen of situaties leiden tot slechte beoordelingen?
Schrijf een beknopte analyse in 3 tot 5 alinea's. Platte tekst, geen markdown, geen opsommingstekens.
Schrijf in het Nederlands. Spreek de lezer aan met "jij" en "jou". Nooit "u".
Gebruik NOOIT een streepje als leesteken. Herschrijf zinnen zonder streepjes.
Schrijf de analyse zonder tijdslimiet: geen "vandaag", "morgen", "deze week".`,
    messages: [{
      role: 'user',
      content: `Analyseer deze ${logs.length} negatief beoordeelde ArnoBot-antwoorden en identificeer structurele patronen:\n\n${content}`,
    }],
  })

  const text = (response.content.find(b => b.type === 'text') as { type: 'text'; text: string } | undefined)?.text ?? ''

  return NextResponse.json({ analyse: text, count: logs.length })
}
