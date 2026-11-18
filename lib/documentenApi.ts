// Gedeelde voorkant van de document-API's (app/api/bot/documenten/**): inloggen, en de schakelaar voor de
// documentenfunctie. Wie de functie niet heeft krijgt een 404, alsof de route niet bestaat.
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { documentenBeschikbaarVoor } from '@/lib/documentenRegels'

export const documentenDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function documentenGebruiker(): Promise<{ userId: string } | { fout: NextResponse }> {
  const { userId } = await auth()
  if (!userId) return { fout: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (!documentenBeschikbaarVoor(userId)) return { fout: NextResponse.json({ error: 'niet_gevonden' }, { status: 404 }) }
  return { userId }
}

/** Een foutcode uit lib/documenten.ts omzetten naar een HTTP-status. */
export function statusVoorFout(code: string): number {
  if (code === 'niet_gevonden') return 404
  if (code === 'ongeldig_id' || code === 'naam_leeg' || code === 'docs_vol' || code === 'bestand_te_groot' || code === 'pdf_te_lang'
    || code === 'bestandstype_niet_ondersteund' || code === 'bestand_niet_leesbaar') return 400
  return 500
}
