export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import * as Sentry from '@sentry/nextjs'
import Anthropic from '@anthropic-ai/sdk'
import { getText } from '@/lib/ai'
import { getPersonaBeschrijving, WEERSTAND_INSTRUCTIE } from '@/lib/sparringPersonas'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { message, history, rolCategorie, persona, weerstand, context } = body
  if (typeof message !== 'string' || message.length > 2000) {
    return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 })
  }
  if (Array.isArray(history) && history.length > 40) {
    return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 })
  }
  if (context && (typeof context !== 'string' || context.length > 500)) {
    return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 })
  }

  const personaBeschrijving = getPersonaBeschrijving(rolCategorie, persona, context)
  const weerstandInstructie = WEERSTAND_INSTRUCTIE[weerstand] ?? WEERSTAND_INSTRUCTIE.stevig

  // Aantal beurten tot nu toe (user + assistant samen). Na een stuk of acht uitwisselingen
  // leunt de persona zelf richting afronden, zoals een echte koper een gesprek op een gegeven
  // moment beeindigt (akkoord, hard nee, of het loopt dood).
  const beurten = Array.isArray(history) ? history.length : 0
  const afrondNudge = beurten >= 16
    ? '\n\nDit gesprek loopt al even. Als er geen echte voortgang meer is, of als jouw positie duidelijk is, rond het dan nu zelf af zoals hierboven beschreven.'
    : ''

  const systemPrompt = `${personaBeschrijving}

${weerstandInstructie}

${context ? `Context van de gebruiker: "${context}"` : ''}

AFRONDEN:
- Jij mag dit gesprek zelf beeindigen wanneer de situatie erom vraagt: je bent tot een akkoord gekomen, je hebt een duidelijk nee, of de gebruiker draait al een paar beurten in kringetjes zonder iets nieuws te brengen.
- Doe dat in karakter, met een korte, natuurlijke afsluitzin. Geen aankondiging dat "het gesprek nu stopt", gewoon zoals je een echte afspraak zou afronden.
- Zet dan, en alleen dan, op de allerlaatste regel van je bericht precies dit token, op een eigen regel, zonder verdere tekst erachter: [EINDE]
- Zolang je nog niet afrondt: nooit [EINDE] gebruiken.${afrondNudge}

REGELS:
- Blijf altijd volledig in karakter. Nooit coachen of hints geven. Je bent de tegenstander.
- Spreek in het Nederlands.
- Spreek de gebruiker ALTIJD aan met "jij" en "jou". Nooit "u". Ongeacht hoe senior of formeel de persoon is die je speelt.
- Praat zoals een echte mens in een zakelijk gesprek. Geen gestructureerde betogen, geen opsommingen. Reageer op wat er net gezegd is. Gebruik de lengte die het gesprek vraagt, niet meer en niet minder.
- Vermijd het patroon "ja, maar ..." en het reflexmatig onderbouwen van elk bezwaar met "want ..." of "omdat ...". Een echte sceptische gesprekspartner concedeert niet eerst beleefd en legt niet alles uit. Een kale tegenwerping of een tegenvraag is vaak genoeg.
- Wissel je lengte af. Soms een half zinnetje of alleen een vraag ("En dan?", "Dat zegt iedereen."), niet elke beurt een volledige alinea.
- Nooit de vierde wand doorbreken.
- Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Herschrijf zinnen zonder streepjes.
- Gebruik geen accenten om woorden te benadrukken (geen écht, dát, zó, dít, én).
- Ga altijd uit van wat de gebruiker zegt. Zeg nooit "ik herinner me dat niet" of "dat heb ik niet gezegd". Accepteer de premisse als waar en reageer vanuit jouw eigen positie.
- Als de gebruiker expliciet uit het spel stapt ("hoe doe ik het?", "stop even", "geef feedback"), reageer dan kort en neutraal: "We stoppen hier. De debrief volgt direct." Niet meer dan dat.`

  const messages = [
    ...(history || []),
    { role: 'user' as const, content: message },
  ]

  const callModel = () => Sentry.startSpan({ name: 'sparring.main-response', op: 'ai.claude' }, () =>
    anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: systemPrompt,
      messages,
    })
  )

  let answer = ''
  for (let i = 0; i < 2 && !answer; i++) {
    try {
      answer = getText(await callModel().then(r => r.content))
    } catch (e) {
      Sentry.captureException(e)
    }
  }
  if (!answer) {
    console.error('[sparring/chat] leeg antwoord na retry, userId:', userId)
    return NextResponse.json({ error: 'Kon geen antwoord genereren' }, { status: 502 })
  }

  // De persona sluit het gesprek af met een [EINDE]-token op de laatste regel (zie AFRONDEN
  // in de systeemprompt). Token eruit strippen vóór het naar de client gaat, zodat het nooit
  // zichtbaar wordt of in de history terechtkomt; `ended` stuurt de client naar de debrief.
  const ended = /\[EINDE\]\s*$/i.test(answer.trim())
  if (ended) answer = answer.replace(/\s*\[EINDE\]\s*$/i, '').trim()

  return NextResponse.json({ answer, ended })
}
