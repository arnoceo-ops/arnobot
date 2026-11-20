/**
 * Kostenplafond voor lokale meetscripts (eval-*, test-*), want die gebruiken de dev-key rechtstreeks, buiten de
 * kostenmeting van de app om. Op 2026-11-19 liep Development zo in één dag op tot $29,52 van de limiet van $30.
 *
 * Gebruik: const client = begrens(new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }))
 * - Elke messages.create-aanroep wordt geteld; boven het plafond per run of per dag gooit de volgende aanroep een fout.
 * - Het dagtotaal staat in scripts/.eval-kosten.json (gitignored) en overleeft dus losse runs.
 * - Bewust meer uitgeven: EVAL_PLAFOND_RUN=10 EVAL_PLAFOND_DAG=25 npx tsx scripts/...
 * - Aan het einde van het proces staat één regel met wat deze run kostte en wat het dagtotaal is.
 */
import Anthropic from '@anthropic-ai/sdk'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const PLAFOND_RUN = Number(process.env.EVAL_PLAFOND_RUN ?? 3)
const PLAFOND_DAG = Number(process.env.EVAL_PLAFOND_DAG ?? 10)
const LOGBOEK = join(__dirname, '.eval-kosten.json')

// USD per miljoen tokens [invoer, uitvoer]. Onbekend model: duurste tarief aannemen, liever te veel geteld dan te weinig.
const PRIJZEN: Array<[string, [number, number]]> = [
  ['claude-haiku', [1, 5]],
  ['claude-sonnet', [3, 15]],
  ['claude-fable-5-1', [10, 50]],
  ['claude-fable', [10, 50]],
  ['claude-opus', [15, 75]],
]
const ONBEKEND: [number, number] = [15, 75]

type Usage = { input_tokens?: number | null; output_tokens?: number | null; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null }

function kostenVan(model: string, u: Usage): number {
  const [i, o] = PRIJZEN.find(([prefix]) => model.startsWith(prefix))?.[1] ?? ONBEKEND
  return ((u.input_tokens ?? 0) * i + (u.cache_creation_input_tokens ?? 0) * i * 1.25 + (u.cache_read_input_tokens ?? 0) * i * 0.1 + (u.output_tokens ?? 0) * o) / 1e6
}

const vandaag = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })

function leesDag(): number {
  try {
    if (!existsSync(LOGBOEK)) return 0
    const l = JSON.parse(readFileSync(LOGBOEK, 'utf8')) as { datum: string; usd: number }
    return l.datum === vandaag() ? l.usd : 0
  } catch {
    return 0
  }
}

let dezeRun = 0
let afsluitHaakGezet = false

function boek(usd: number) {
  dezeRun += usd
  writeFileSync(LOGBOEK, JSON.stringify({ datum: vandaag(), usd: leesDag() + usd }))
}

function controleer() {
  if (dezeRun >= PLAFOND_RUN) throw new Error(`Plafond per run bereikt ($${dezeRun.toFixed(2)} van $${PLAFOND_RUN}). Verhoog met EVAL_PLAFOND_RUN als dit bewust is.`)
  const dag = leesDag()
  if (dag >= PLAFOND_DAG) throw new Error(`Dagplafond bereikt ($${dag.toFixed(2)} van $${PLAFOND_DAG} vandaag). Verhoog met EVAL_PLAFOND_DAG als dit bewust is.`)
}

export function begrens<T extends Anthropic>(client: T): T {
  if (!afsluitHaakGezet) {
    afsluitHaakGezet = true
    process.on('exit', () => console.log(`\n[evalBudget] deze run $${dezeRun.toFixed(2)}, vandaag in totaal $${leesDag().toFixed(2)} (plafond run $${PLAFOND_RUN}, dag $${PLAFOND_DAG})`))
  }
  const origineel = client.messages.create.bind(client.messages) as (...a: unknown[]) => Promise<unknown>
  ;(client.messages as unknown as { create: unknown }).create = async (...args: unknown[]) => {
    controleer()
    const res = (await origineel(...args)) as { model?: string; usage?: Usage }
    if (res?.usage) boek(kostenVan(res.model ?? (args[0] as { model?: string })?.model ?? '', res.usage))
    return res
  }
  return client
}
