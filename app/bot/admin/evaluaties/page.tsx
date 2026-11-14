import { redirect } from 'next/navigation'

// De FEEDBACK-pagina is opgegaan in Gesprekken (filter DUIMPJE, "alleen negatief") en STATS (het
// percentage positief). Deze redirect houdt een oud bladwijzertje werkend.
export default function EvaluatiesVerhuisd() {
  redirect('/bot/admin?fb=neg')
}
