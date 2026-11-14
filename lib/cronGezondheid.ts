import { maxLeeftijdMs } from '@/lib/cronOverzicht'
import { nlDatumTekst, nlTijdTekst } from '@/lib/nlTijd'
import type { CronRunRij } from '@/lib/cronRun'

// Beoordeelt per cron of hij gezond is, op basis van cron_runs (lib/cronRun.ts) en het schema uit
// vercel.json. Puur en getest: de pagina's tonen alleen wat hier uitkomt.
//
//  ok          laatste run gelukt en niet te oud voor het schema
//  te_laat     laatste succes ouder dan het schema toestaat: de cron draait niet meer
//  fout        de laatste afgeronde run is mislukt
//  afgebroken  een run is gestart maar nooit afgerond (meestal een timeout)
//  onbekend    nog nooit gedraaid sinds de registratie bestaat, of een eenmalige cron zonder run

export type CronStaat = 'ok' | 'te_laat' | 'fout' | 'afgebroken' | 'onbekend'
export type CronGezondheid = { staat: CronStaat; tekst: string }

// Een cron die net draait is niet afgebroken. De langste maxDuration is 300 seconden.
const AFGEBROKEN_NA_MS = 15 * 60_000

const kort = (iso: string) => `${nlDatumTekst(iso).slice(0, 5)} ${nlTijdTekst(iso).slice(0, 5)}`
const ms = (iso: string | null) => (iso ? Date.parse(iso) : NaN)

export function beoordeelCron(run: CronRunRij | null | undefined, schema: string, nu: Date = new Date()): CronGezondheid {
  if (!run) return { staat: 'onbekend', tekst: 'nog niet gedraaid sinds registratie' }

  const start = ms(run.laatste_start)
  const ok = ms(run.laatste_ok)
  const fout = ms(run.laatste_fout)
  const laatsteAfgerond = Math.max(Number.isNaN(ok) ? -Infinity : ok, Number.isNaN(fout) ? -Infinity : fout)

  if (!Number.isNaN(start) && start > laatsteAfgerond && nu.getTime() - start > AFGEBROKEN_NA_MS) {
    return { staat: 'afgebroken', tekst: `gestart ${kort(run.laatste_start!)}, niet afgerond` }
  }
  if (!Number.isNaN(fout) && fout >= (Number.isNaN(ok) ? -Infinity : ok)) {
    return { staat: 'fout', tekst: `mislukt ${kort(run.laatste_fout!)}${run.laatste_fout_tekst ? `: ${run.laatste_fout_tekst}` : ''}` }
  }
  if (!Number.isNaN(ok)) {
    const max = maxLeeftijdMs(schema)
    if (max !== null && nu.getTime() - ok > max) return { staat: 'te_laat', tekst: `laatst gelukt ${kort(run.laatste_ok!)}, te lang geleden` }
    return { staat: 'ok', tekst: `gelukt ${kort(run.laatste_ok!)}` }
  }
  return { staat: 'onbekend', tekst: 'nog niet gedraaid sinds registratie' }
}

export const STAAT_KLEUR: Record<CronStaat, string> = {
  ok: '#22c55e',
  te_laat: '#cc2200',
  fout: '#cc2200',
  afgebroken: '#f59e0b',
  onbekend: '#6b7280',
}
