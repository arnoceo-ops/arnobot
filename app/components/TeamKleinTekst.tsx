import { TEAM_KLEIN_TEKST } from '@/lib/teamPricing'

// De tekst voor teams onder het minimum, met een aanklikbaar adres. De woorden staan op een plek (lib/teamPricing.ts).
const ADRES = 'team@arno.bot'

export default function TeamKleinTekst() {
  const [voor, na] = TEAM_KLEIN_TEKST.split(ADRES)
  return <>{voor}<a href={`mailto:${ADRES}`} style={{ color: '#f59e0b' }}>{ADRES}</a>{na}</>
}
