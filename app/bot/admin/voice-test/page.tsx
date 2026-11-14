import { redirect } from 'next/navigation'

// De TEMP-pagina (voice-test en persona-switcher) is opgeruimd: de voice-test was 4 keer gebruikt,
// voor het laatst op 12 augustus 2026, en de persona-knoppen staan nu onderaan /bot/admin/gebruikers.
// Deze redirect houdt een oud bladwijzertje werkend.
export default function VoiceTestVerhuisd() {
  redirect('/bot/admin/gebruikers')
}
