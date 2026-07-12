import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Generieke event-logging (paginabezoeken, klik-events) in één tabel, zodat een nieuwe
// metric later geen nieuwe tabel/migratie vereist. Fire-and-forget: een mislukte log-poging
// mag nooit de pagina of actie van de gebruiker breken.
export async function logEvent(userId: string, eventName: string): Promise<void> {
  try {
    const { error } = await supabase.from('arnobot_events').insert({ user_id: userId, event_name: eventName })
    if (error) console.error(`[events] loggen van "${eventName}" mislukt:`, error.message)
  } catch (err) {
    console.error(`[events] loggen van "${eventName}" mislukt:`, err instanceof Error ? err.message : String(err))
  }
}
