import { createClient } from '@supabase/supabase-js'
import type { ActieveStoring } from '@/lib/storing'

// Onthoudt welke storingen actief zijn, zodat storing-wacht kan melden dat er één voorbij is.
// Eén rij in arnobot_meta (sleutel/waarde). Een fout bij lezen of schrijven mag de wacht nooit
// laten falen: zonder staat is er alleen geen herstelbericht.

const SLEUTEL = 'storing_actief'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function leesActieveStoringen(): Promise<ActieveStoring[]> {
  try {
    const { data, error } = await db().from('arnobot_meta').select('value').eq('key', SLEUTEL).maybeSingle()
    if (error || !data?.value) return []
    const lijst = JSON.parse(data.value)
    return Array.isArray(lijst) ? lijst : []
  } catch {
    return []
  }
}

export async function schrijfActieveStoringen(lijst: ActieveStoring[]): Promise<void> {
  try {
    const { error } = await db().from('arnobot_meta').upsert({ key: SLEUTEL, value: JSON.stringify(lijst) }, { onConflict: 'key' })
    if (error) throw new Error(error.message)
  } catch (e) {
    console.error('[storingStaat] schrijven mislukt:', e instanceof Error ? e.message : e)
  }
}
