// MRR uit arnobot_subscriptions, de bron die de Mollie-flow echt bijhoudt. De oude berekening
// las approved_users.bedrag en .interval, kolommen die sinds Mollie door niets meer worden
// geschreven: de MRR bleef daardoor op 0, ook met betalende abonnees.
//
// Definitie (bewust zo):
//  - alleen status 'active';
//  - zonder opzegging: een abonnement waarvoor een opzegging is aangevraagd loopt nog tot het
//    einde van de periode, maar komt niet terug en telt dus niet meer mee;
//  - exclusief btw (bedrag_cent is bruto, btw_cent zit erin);
//  - jaarlijks gedeeld door 12, een onbekende cyclus wordt overgeslagen in plaats van gegokt.
// Alleen solo-abonnementen. Team wordt gefactureerd per cyclus met naar-rato tussenfacturen
// (arnobot_team_facturen), daar is geen vaste maandwaarde uit af te lezen: niet meegeteld.

export type AbonnementRij = {
  status: string
  cyclus: string | null
  bedrag_cent: number | null
  btw_cent: number | null
  opzegging_aangevraagd_at: string | null
}

export function berekenMrrEuro(rijen: AbonnementRij[]): number {
  let cent = 0
  for (const r of rijen) {
    if (r.status !== 'active') continue
    if (r.opzegging_aangevraagd_at) continue
    if (r.bedrag_cent == null) continue
    const netto = r.bedrag_cent - (r.btw_cent ?? 0)
    if (r.cyclus === 'maandelijks') cent += netto
    else if (r.cyclus === 'jaarlijks') cent += netto / 12
  }
  return cent / 100
}
