import { createClient } from '@supabase/supabase-js'
import { excludeInternalTestUsers } from '@/lib/internalTestAccounts'
import { ARNO_ERVARING } from '@/lib/arnoFeiten'
import { beoordeelAntwoord, type Bewering, type Oordeel } from '@/lib/waarheidsControle'

// Wekelijkse steekproef voor Arno: alle antwoorden van de afgelopen week met een bewaarde bron
// (arnobot_rds_logs.bron_context) gaan door de waarheidscontrole. Arno krijgt een mail met de
// antwoorden waarin ArnoBot beweringen doet die niet uit de bron komen, plus een paar antwoorden
// zonder vlag als controle (zodat hij ziet wat de beoordelaar mist). Zie docs/CLAUDE_HISTORY.md.

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const MAX_ANTWOORDEN = 120 // bovengrens per run, tegen een uit de hand lopende week
const GELIJKTIJDIG = 4
export const MAX_HOOG = 15
export const MAX_MIDDEL = 10
export const MAX_LAAG = 5
export const AANTAL_CONTROLE = 5

type Rij = { id: string; user_id: string | null; session_id: string; question: string; answer: string; created_at: string; bron_context: string | null }
export type Beoordeeld = { rij: Rij; eerder: string[]; oordeel: Oordeel; ongedekt: Bewering[]; hoogste: 'hoog' | 'middel' | 'laag' | null }

export type Rapport = {
  gecontroleerd: number
  zonderBron: number
  mislukt: number
  hoog: number
  middel: number
  laag: number
  schoon: number
  geselecteerd: { hoog: Beoordeeld[]; middel: Beoordeeld[]; laag: Beoordeeld[]; controle: Beoordeeld[] }
}

const RANG = { hoog: 3, middel: 2, laag: 1 } as const

function hoogsteErnst(ongedekt: Bewering[]): Beoordeeld['hoogste'] {
  let top: Beoordeeld['hoogste'] = null
  for (const b of ongedekt) if (!top || RANG[b.ernst] > RANG[top]) top = b.ernst
  return top
}

async function metGelijktijdigheid<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const uit: R[] = new Array(items.length)
  let volgende = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (true) {
      const i = volgende++
      if (i >= items.length) return
      uit[i] = await fn(items[i])
    }
  }))
  return uit
}

function schud<T>(lijst: T[]): T[] {
  const kopie = [...lijst]
  for (let i = kopie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[kopie[i], kopie[j]] = [kopie[j], kopie[i]]
  }
  return kopie
}

export async function maakWaarheidsRapport(opties: { dagen?: number; ookEigenaar?: boolean } = {}): Promise<Rapport> {
  const sinds = new Date(Date.now() - (opties.dagen ?? 7) * 864e5).toISOString()
  const eigenaar = process.env.ARNOBOT_OWNER_USER_ID

  let query = supabase
    .from('arnobot_rds_logs')
    .select('id, user_id, session_id, question, answer, created_at, bron_context')
    .gte('created_at', sinds)
  const { data, error } = await excludeInternalTestUsers(query).order('created_at', { ascending: true }).limit(MAX_ANTWOORDEN * 2)
  if (error) throw error

  let rijen = ((data ?? []) as Rij[]).filter(r => r.user_id && typeof r.answer === 'string' && r.answer.length > 0)
  // Arno's eigen testgesprekken horen niet in een steekproef over wat gebruikers te zien krijgen.
  if (!opties.ookEigenaar && eigenaar) rijen = rijen.filter(r => r.user_id !== eigenaar)

  const zonderBron = rijen.filter(r => !r.bron_context).length
  const metBron = rijen.filter(r => r.bron_context).slice(-MAX_ANTWOORDEN)

  const vragenPerSessie = new Map<string, string[]>()
  const taken = metBron.map(rij => {
    const eerder = vragenPerSessie.get(rij.session_id) ?? []
    vragenPerSessie.set(rij.session_id, [...eerder, rij.question.slice(0, 1500)])
    return { rij, eerder: eerder.slice(-6) }
  })

  let mislukt = 0
  const beoordeeld: Beoordeeld[] = (await metGelijktijdigheid(taken, GELIJKTIJDIG, async ({ rij, eerder }) => {
    try {
      const oordeel = await beoordeelAntwoord({
        vraag: rij.question.slice(0, 3000),
        antwoord: rij.answer,
        eerdereBerichten: eerder,
        bron: rij.bron_context ?? '',
        vasteFeiten: `Arno heeft ${ARNO_ERVARING}.`,
      })
      if (oordeel.fout) { mislukt++; return null }
      const ongedekt = oordeel.beweringen.filter(b => !b.gedekt)
      return { rij, eerder, oordeel, ongedekt, hoogste: hoogsteErnst(ongedekt) } as Beoordeeld
    } catch {
      mislukt++
      return null
    }
  })).filter((x): x is Beoordeeld => x !== null)

  const op = (e: 'hoog' | 'middel' | 'laag') => beoordeeld.filter(b => b.hoogste === e)
  const schoon = beoordeeld.filter(b => b.hoogste === null)

  return {
    gecontroleerd: beoordeeld.length,
    zonderBron,
    mislukt,
    hoog: op('hoog').length,
    middel: op('middel').length,
    laag: op('laag').length,
    schoon: schoon.length,
    geselecteerd: {
      hoog: op('hoog').slice(0, MAX_HOOG),
      middel: op('middel').slice(0, MAX_MIDDEL),
      laag: op('laag').slice(0, MAX_LAAG),
      controle: schud(schoon).slice(0, AANTAL_CONTROLE),
    },
  }
}

// ---- Mail ----

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function markeer(antwoord: string, ongedekt: Bewering[]): string {
  let html = esc(antwoord)
  for (const b of ongedekt) {
    const z = esc(b.zin.trim())
    if (z.length > 8 && html.includes(z)) html = html.replace(z, `<mark style="background:#fde68a">${z}</mark>`)
  }
  return html.replace(/\n/g, '<br>')
}

const GROEP: Record<string, string> = {
  feit_cijfer: 'feit of cijfer',
  over_arno_of_arnobot: 'over Arno of ArnoBot',
  over_gebruiker: 'over de gebruiker',
  algemene_kennis: 'algemene kennis',
}

function blok(b: Beoordeeld, label: string): string {
  const datum = b.rij.created_at.slice(0, 10)
  const claims = b.oordeel.beweringen
    .filter(c => !c.gedekt || b.hoogste === null)
    .map(c => `<li><b>${esc(GROEP[c.categorie] ?? c.categorie)}</b> (${c.ernst}${c.gedekt ? ', gedekt' : ', ongedekt'}): ${esc(c.zin)}${c.steun ? `<br><i style="color:#6b7280">steun: ${esc(String(c.steun).slice(0, 200))}</i>` : ''}</li>`)
    .join('')
  return `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:14px;margin:12px 0">
<div style="color:#6b7280;font-size:12px">${label} · ${datum} · gebruiker ${esc((b.rij.user_id ?? '').slice(-6))}</div>
<p style="margin:8px 0"><b>Vraag:</b> ${esc(b.rij.question.slice(0, 400))}</p>
<p style="margin:8px 0"><b>Antwoord:</b><br>${markeer(b.rij.answer.slice(0, 3500), b.ongedekt)}</p>
${claims ? `<ul style="margin:8px 0;padding-left:18px">${claims}</ul>` : ''}
</div>`
}

export function maakRapportMail(r: Rapport): { onderwerp: string; html: string } {
  const g = r.geselecteerd
  const sectie = (titel: string, lijst: Beoordeeld[], label: string) =>
    lijst.length ? `<h3 style="margin:24px 0 4px">${titel} (${lijst.length})</h3>${lijst.map(b => blok(b, label)).join('')}` : ''
  const html = `<div style="font-family:Arial,sans-serif;max-width:720px;color:#111827">
<h2>ArnoBot waarheidscontrole, afgelopen week</h2>
<p>${r.gecontroleerd} antwoorden gecontroleerd. Beweringen die niet uit de bibliotheek, de input van de gebruiker of de vaste feiten komen:
<b>${r.hoog}</b> met hoge ernst (cijfers, feiten, Arno of ArnoBot), <b>${r.middel}</b> middel (over de gebruiker), <b>${r.laag}</b> algemene kennis. ${r.schoon} antwoorden zonder vlag.
${r.zonderBron ? `<br>${r.zonderBron} antwoorden zonder bewaarde bron zijn niet gecontroleerd.` : ''}${r.mislukt ? `<br>${r.mislukt} controles zijn mislukt.` : ''}</p>
<p style="color:#6b7280">Per antwoord: zet je het eens met wat hier in jouw naam staat? Wat niet klopt, geef je door, dan wordt het een testgeval en een gerichte aanpassing.</p>
${sectie('Hoge ernst', g.hoog, 'HOOG')}${sectie('Middel', g.middel, 'MIDDEL')}${sectie('Algemene kennis (zijn dit jouw woorden?)', g.laag, 'ALGEMEEN')}${sectie('Controle: zonder vlag, kijk of de beoordelaar iets mist', g.controle, 'CONTROLE')}
</div>`
  return { onderwerp: `ArnoBot waarheidscontrole: ${r.hoog} hoog, ${r.middel} middel (${r.gecontroleerd} gecontroleerd)`, html }
}
