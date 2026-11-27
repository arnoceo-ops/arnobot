import { TEAM_KLEIN_TEKST } from '@/lib/teamPricing'

// Een vaste teamtekst met aanklikbaar adres (standaard die voor teams onder het minimum). De woorden staan op een plek
// (lib/teamPricing.ts).
const ADRES = 'team@arno.bot'

export default function TeamKleinTekst({ tekst = TEAM_KLEIN_TEKST }: { tekst?: string }) {
  const [voor, na] = tekst.split(ADRES)
  return <>{voor}<a href={`mailto:${ADRES}`} style={{ color: '#f59e0b' }}>{ADRES}</a>{na}</>
}
