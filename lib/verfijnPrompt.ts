// Stukje systeemprompt voor "verbeter mijn prompt" (app/api/bot/verfijn/route.ts). De verbeteraar ziet alleen
// de tekst uit het invoerveld. Hangt er een bijlage aan het bericht, dan verwijst die tekst vaak naar "dit
// document" zonder dat de verbeteraar weet dat het bestaat; hij antwoordde dan zelf ("ik heb niets ontvangen")
// in plaats van de vraag te verbeteren. Daarom krijgt hij de bestandsnaam, nooit de inhoud.
import { schoneBestandsnaam } from './documentenRegels'

export function bijlageHint(bijlageNaam: unknown): string {
  if (typeof bijlageNaam !== 'string' || bijlageNaam.trim() === '') return ''
  const naam = schoneBestandsnaam(bijlageNaam)
  return `\n\nDe gebruiker heeft een bijlage toegevoegd aan dit bericht (bestandsnaam: ${naam}). Jij ziet de bijlage niet, de coach waar dit bericht naartoe gaat wel. Verwijs in de verbeterde versie gewoon naar het document zoals de gebruiker dat zelf doet. Vraag nooit om de inhoud te plakken en zeg nooit dat je iets niet hebt ontvangen: dat is niet jouw taak.`
}
