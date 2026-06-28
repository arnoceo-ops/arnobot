import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { data } = await supabase
    .from('arnobot_openers')
    .select('strategisch, organisatorisch, operationeel, created_at')
    .eq('id', '00000000-0000-0000-0000-000000000001')
    .maybeSingle()

  if (!data) return NextResponse.json({ openers: null })

  return NextResponse.json({ openers: data })
}
