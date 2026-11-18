// Gedeelde voorkant van de import-API's (app/api/bot/import/**): inloggen en de schakelaar. Wie de functie niet heeft krijgt een 404,
// alsof de route niet bestaat. Verwijderen kan altijd, ook zonder toegang (een gebruiker moet zijn eigen gegevens kunnen wissen).
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { historieImportBeschikbaarVoor } from '@/lib/historieImportRegels'
import { toegangsWeigering } from '@/lib/toegangsPoort'

export const historieImportDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function historieImportGebruiker(opties: { metToegangscontrole: boolean }): Promise<{ userId: string } | { fout: NextResponse }> {
  const { userId } = await auth()
  if (!userId) return { fout: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (!historieImportBeschikbaarVoor(userId)) return { fout: NextResponse.json({ error: 'niet_gevonden' }, { status: 404 }) }
  if (opties.metToegangscontrole) {
    const geenToegang = await toegangsWeigering(userId)
    if (geenToegang) return { fout: geenToegang }
  }
  return { userId }
}
