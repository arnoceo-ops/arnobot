// De enige plek waar een Anthropic-client wordt gemaakt (afgedwongen door scripts/check-ai-meter.mjs in CI). Elke client meet zijn aanroepen
// via de middleware uit lib/aiGebruik.ts en schrijft ze weg in arnobot_ai_gebruik (docs/sql/2026-11-19-ai-gebruik.sql). Geef bij een
// aanroep de gebruiker en de bron mee: client.messages.create(body, aiContext(userId, 'sparring-chat')). Zonder context blijft de aanroep
// gemeten, maar zonder gebruiker.
import Anthropic, { type ClientOptions } from '@anthropic-ai/sdk'
import { maakAiMeter } from '@/lib/aiGebruik'
import { houdInLeven, schrijfAiGebruik } from '@/lib/gebruikOpslag'

export { aiContext } from '@/lib/aiGebruik'

const aiMeter = maakAiMeter(schrijfAiGebruik, houdInLeven)

export function maakAnthropic(opties: ClientOptions = {}): Anthropic {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    ...opties,
    middleware: [...(opties.middleware ?? []), aiMeter],
  })
}
