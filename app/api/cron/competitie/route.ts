import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { notifyCronFailure } from '@/lib/cron-notify'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

const VALID_ROLES = ['Verkoper', 'Salesbaas', 'Eindbaas'] as const
type Rol = typeof VALID_ROLES[number]

const ROL_MAP: Record<string, Rol> = {
  'AE Hunter':     'Verkoper',
  'AM Farmer':     'Verkoper',
  'Key AM':        'Verkoper',
  'Inside Sales':  'Verkoper',
  'Solopreneur':   'Verkoper',
  'Sales Director':'Salesbaas',
  'VP of Sales':   'Salesbaas',
  'CEO/DGA':       'Eindbaas',
}

// Eerste run: 1 oktober 2026
const FIRST_RUN = new Date('2026-10-01T00:00:00Z')

type Kandidaat = {
  userId: string
  naam: string
  rol: Rol
  msaScore: number       // huidig, 1–100
  progressie: number     // delta MSA over 3 maanden
  sessiesPerMaand: number
  compound: number       // 0–1
}

function compoundScore(msa: number, progressie: number, sessiesPerMaand: number): number {
  const normMSA = (msa - 1) / 99                              // 1–100 → 0–1
  const normProg = Math.min(Math.max((progressie + 50) / 100, 0), 1) // ±50 geclipt → 0–1
  const normCons = Math.min(sessiesPerMaand / 15, 1)          // cap op 15/maand
  return 0.5 * normMSA + 0.3 * normProg + 0.2 * normCons
}

function rolLabel(rol: Rol): string {
  if (rol === 'Verkoper') return 'VERKOPERS'
  if (rol === 'Salesbaas') return 'SALES MANAGERS'
  return 'CEO / DGA'
}

function buildEmail(
  date: string,
  rankings: Record<Rol, Kandidaat[]>,
  window: { van: string; tot: string }
): string {
  const categorieen = VALID_ROLES.map(rol => {
    const lijst = rankings[rol]
    if (!lijst.length) return `
      <div style="margin-bottom: 40px;">
        <p style="color: #f59e0b; font-size: 11px; letter-spacing: 4px; margin: 0 0 12px;">${rolLabel(rol)}</p>
        <p style="color: #4b5563; font-size: 13px; font-family: Arial,-apple-system,sans-serif;">Geen kandidaten met voldoende data.</p>
      </div>`

    const rows = lijst.slice(0, 10).map((k, i) => {
      const medal = i === 0 ? '01' : i === 1 ? '02' : i === 2 ? '03' : `${String(i + 1).padStart(2, '0')}`
      const kleur = i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : '#4b5563'
      return `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #1f2937; color: ${kleur}; font-size: 13px; font-family: Arial,-apple-system,sans-serif; font-weight: 700;">${medal}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #1f2937; color: #f1f5f9; font-size: 13px; font-family: Arial,-apple-system,sans-serif;">${k.naam}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #1f2937; color: #f59e0b; font-size: 13px; font-family: Arial,-apple-system,sans-serif; text-align: right;">${k.msaScore}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #1f2937; color: ${k.progressie >= 0 ? '#4ade80' : '#f87171'}; font-size: 13px; font-family: Arial,-apple-system,sans-serif; text-align: right;">${k.progressie >= 0 ? '+' : ''}${k.progressie}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #1f2937; color: #6b7280; font-size: 13px; font-family: Arial,-apple-system,sans-serif; text-align: right;">${k.sessiesPerMaand.toFixed(1)}/mnd</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #1f2937; color: #9ca3af; font-size: 13px; font-family: Arial,-apple-system,sans-serif; text-align: right;">${(k.compound * 100).toFixed(1)}</td>
        </tr>`
    }).join('')

    return `
      <div style="margin-bottom: 48px;">
        <p style="color: #f59e0b; font-size: 11px; letter-spacing: 4px; margin: 0 0 12px;">${rolLabel(rol)}</p>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="text-align: left; padding: 6px 12px; color: #374151; font-size: 11px; letter-spacing: 2px; border-bottom: 1px solid #374151;">#</th>
              <th style="text-align: left; padding: 6px 12px; color: #374151; font-size: 11px; letter-spacing: 2px; border-bottom: 1px solid #374151;">NAAM</th>
              <th style="text-align: right; padding: 6px 12px; color: #374151; font-size: 11px; letter-spacing: 2px; border-bottom: 1px solid #374151;">MSA</th>
              <th style="text-align: right; padding: 6px 12px; color: #374151; font-size: 11px; letter-spacing: 2px; border-bottom: 1px solid #374151;">ΔMSA</th>
              <th style="text-align: right; padding: 6px 12px; color: #374151; font-size: 11px; letter-spacing: 2px; border-bottom: 1px solid #374151;">SESSIES</th>
              <th style="text-align: right; padding: 6px 12px; color: #374151; font-size: 11px; letter-spacing: 2px; border-bottom: 1px solid #374151;">SCORE</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`
  }).join('')

  return `
    <div style="background: #111827; color: #f1f5f9; padding: 48px 40px 40px; max-width: 760px; margin: 0 auto; font-family: Arial,-apple-system,sans-serif;">
      <p style="font-family:'Arial Black',Arial,Impact,sans-serif;font-size:26px;letter-spacing:6px;margin:0 0 32px;line-height:1;"><span style="color:#f1f5f9;">ARNO</span><span style="color:#f59e0b;">BOT</span></p>
      <h1 style="font-size: 28px; font-weight: 700; margin: 0 0 4px; color: #f1f5f9;">MAANDELIJKSE COMPETITIE</h1>
      <p style="color: #6b7280; font-size: 13px; margin: 0 0 8px;">${date}</p>
      <p style="color: #4b5563; font-size: 12px; margin: 0 0 32px;">Periode: ${window.van} t/m ${window.tot}</p>

      <p style="color: #9ca3af; font-size: 13px; line-height: 1.8; margin: 0 0 32px;">
        Ranking op compound score: 50% MSA (huidig), 30% progressie (ΔMSA over 3 maanden), 20% consistentie.<br>
        Alleen gebruikers met minimaal 2 coaching-updates in de periode en een rol in hun profiel.
      </p>

      ${categorieen}

      <p style="color: #374151; font-size: 12px; margin: 0;">Gebruikers zonder rol of met slechts één coaching-score zijn uitgesloten.</p>
    </div>
  `
}

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {

  if (new Date() < FIRST_RUN) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'voor_startdatum', start: FIRST_RUN.toISOString() })
  }

  const now = new Date()
  const vanDatum = new Date(now)
  vanDatum.setMonth(vanDatum.getMonth() - 3)

  const van = vanDatum.toISOString()
  const tot = now.toISOString()

  const windowLabel = {
    van: vanDatum.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }),
    tot: now.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }),
  }

  // Profielen met geldige rol
  const { data: profielen } = await supabase
    .from('arnobot_blog_profiles')
    .select('user_id, profiel')

  const geldig = (profielen ?? []).filter(p => ROL_MAP[p.profiel?.rol] !== undefined)
  if (!geldig.length) return NextResponse.json({ ok: true, skipped: true, kandidaten: 0 })

  const userIds = geldig.map(p => p.user_id)

  // Namen ophalen
  const { data: gebruikers } = await supabase
    .from('approved_users')
    .select('user_id, voornaam, achternaam')
    .in('user_id', userIds)

  const naamMap: Record<string, string> = {}
  for (const u of gebruikers ?? []) {
    naamMap[u.user_id] = [u.voornaam, u.achternaam].filter(Boolean).join(' ') || u.user_id.slice(0, 8)
  }

  // Coaching-scores per gebruiker in de periode
  const { data: alleScores } = await supabase
    .from('arnobot_coaching_scores')
    .select('user_id, msa_score, created_at')
    .in('user_id', userIds)
    .gte('created_at', van)
    .lte('created_at', tot)
    .order('created_at', { ascending: true })

  // Sessies per gebruiker in de periode
  const { data: alleSessies } = await supabase
    .from('arnobot_blog_sessions')
    .select('user_id, created_at')
    .in('user_id', userIds)
    .gte('created_at', van)
    .lte('created_at', tot)

  const kandidaten: Kandidaat[] = []

  for (const profiel of geldig) {
    const userId = profiel.user_id
    const rol = ROL_MAP[profiel.profiel.rol]
    if (!rol) continue

    const scores = (alleScores ?? []).filter(s => s.user_id === userId)
    if (scores.length < 2) continue // minimaal 2 coaching-scores vereist

    const msaScore = scores[scores.length - 1].msa_score
    const progressie = msaScore - scores[0].msa_score

    const sessieCount = (alleSessies ?? []).filter(s => s.user_id === userId).length
    const sessiesPerMaand = sessieCount / 3

    kandidaten.push({
      userId,
      naam: naamMap[userId] ?? userId.slice(0, 8),
      rol,
      msaScore,
      progressie,
      sessiesPerMaand,
      compound: compoundScore(msaScore, progressie, sessiesPerMaand),
    })
  }

  const rankings = Object.fromEntries(
    VALID_ROLES.map(rol => [
      rol,
      kandidaten.filter(k => k.rol === rol).sort((a, b) => b.compound - a.compound),
    ])
  ) as Record<Rol, Kandidaat[]>

  const date = now.toLocaleDateString('nl-NL', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam',
  })

  await resend.emails.send({
    from: 'Arno <arno@arno.bot>',
    to: 'arno@arno.bot',
    subject: `Competitie ${date}`,
    html: buildEmail(date, rankings, windowLabel),
  })

  return NextResponse.json({
    ok: true,
    kandidaten: kandidaten.length,
    per_categorie: Object.fromEntries(VALID_ROLES.map(r => [r, rankings[r].length])),
  })
  } catch (err) {
    await notifyCronFailure('competitie', err)
    return NextResponse.json({ error: 'cron_error' }, { status: 500 })
  }
}
