import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

// Registreert van elke geplande cron de laatste start, het laatste succes en de laatste fout in
// cron_runs (docs/sql/2026-11-14-admin-log-en-cron-runs.sql), zodat de admin kan tonen "laatst
// gelukt op ..." en een cron kan markeren die te laat of mislukt is (lib/cronGezondheid.ts).
//
// Gebruik in elke cron-route (lib/cronOverzicht.test.ts dwingt af dat dit overal staat):
//   async function cronHandler(req: NextRequest) { ... }
//   export const GET = registreerCronRun('/api/cron/naam', cronHandler)
//
// Alleen echte, geautoriseerde runs tellen (een aanroep zonder geldig CRON_SECRET krijgt van de
// handler zelf een 401) en een droge run (?dry) niet. Een mislukte registratie laat de cron
// zelf nooit falen: het is boekhouding, geen onderdeel van het werk.

export type CronRunRij = {
  naam: string
  laatste_start: string | null
  laatste_ok: string | null
  laatste_fout: string | null
  laatste_fout_tekst: string | null
  laatste_duur_ms: number | null
}

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function schrijf(naam: string, velden: Record<string, unknown>): Promise<void> {
  try {
    const { error } = await db()
      .from('cron_runs')
      .upsert({ naam, ...velden, updated_at: new Date().toISOString() }, { onConflict: 'naam' })
    if (error) throw new Error(error.message)
  } catch (e) {
    console.error('[cronRun]', naam, e instanceof Error ? e.message : e)
  }
}

async function foutTekst(res: Response): Promise<string> {
  try {
    const body = await res.clone().json()
    const tekst = typeof body?.error === 'string' ? body.error : typeof body?.message === 'string' ? body.message : ''
    return `HTTP ${res.status}${tekst ? `: ${tekst}` : ''}`.slice(0, 300)
  } catch {
    return `HTTP ${res.status}`
  }
}

export function registreerCronRun(pad: string, handler: (req: NextRequest) => Promise<Response>) {
  return async function GET(req: NextRequest): Promise<Response> {
    const geautoriseerd = req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
    if (!geautoriseerd || req.nextUrl.searchParams.has('dry')) return handler(req)

    const start = Date.now()
    await schrijf(pad, { laatste_start: new Date(start).toISOString() })
    try {
      const res = await handler(req)
      const duur = Date.now() - start
      if (res.status < 400) {
        await schrijf(pad, { laatste_ok: new Date().toISOString(), laatste_duur_ms: duur })
      } else {
        await schrijf(pad, { laatste_fout: new Date().toISOString(), laatste_fout_tekst: await foutTekst(res), laatste_duur_ms: duur })
      }
      return res
    } catch (e) {
      await schrijf(pad, {
        laatste_fout: new Date().toISOString(),
        laatste_fout_tekst: (e instanceof Error ? e.message : String(e)).slice(0, 300),
        laatste_duur_ms: Date.now() - start,
      })
      throw e
    }
  }
}

export async function leesCronRuns(): Promise<Record<string, CronRunRij>> {
  const { data } = await db()
    .from('cron_runs')
    .select('naam, laatste_start, laatste_ok, laatste_fout, laatste_fout_tekst, laatste_duur_ms')
    .limit(500)
  return Object.fromEntries(((data ?? []) as CronRunRij[]).map(r => [r.naam, r]))
}
