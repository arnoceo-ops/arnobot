/**
 * Maakt de MSA-scores van de Team Hippios-leden realistischer: ze stonden te hoog
 * (Lisa 5/5/5 = 100, Benny 5/5/4 enz.), terwijl een echt team verschillende sterke en zwakke
 * pijlers heeft, met dips en aandachtspunten. Dit script is de leidende bron voor de scores
 * vanaf mei 2026 en hoort na seed-hippios-demo.mjs en seed-demo-okt.mjs te draaien
 * (die twee schrijven nog hun oude, hogere waarden bij een herhaalde run).
 *
 * Werkt bij: arnobot_coaching_scores (reeks), arnobot_1on1_log (scores per 1:1),
 * arnobot_coaching (huidige scores, richting, twee diagnoses), arnobot_coaching_history.
 *
 * Eindstand 5 oktober (MSA): Benny 3/4/5 (80), Alira 4/3/4 (73), Lisa 5/4/4 (87).
 * Uitvoeren: node scripts/seed-demo-msa.mjs
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf-8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '')
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const ME = 'user_3HFvMfJ8ztQxatkJg3SWdSJPz4D'
const U = { benny: 'fake_benny_verwaaijen_001', alira: 'fake_user_alira_bretton', lisa: 'fake_user_lisa_bakker' }
const msa = (m, s, a) => Math.max(1, Math.round((m + s + a) / 15 * 100))

// [datum, mindset, systeem, actie] per checkpoint (tweewekelijks, maandagen)
const SERIES = {
  benny: [['05-02', 3, 3, 4], ['05-16', 3, 3, 4], ['05-30', 4, 3, 4], ['06-13', 4, 4, 4], ['06-29', 4, 4, 4], ['07-13', 3, 3, 4], ['07-27', 3, 3, 4],
    ['08-10', 4, 3, 4], ['08-24', 4, 4, 4], ['09-07', 4, 4, 5], ['09-21', 4, 4, 5], ['10-05', 3, 4, 5]],
  alira: [['05-02', 3, 3, 3], ['05-16', 3, 3, 4], ['05-30', 4, 3, 3], ['06-13', 3, 3, 4], ['06-29', 4, 3, 4], ['07-13', 3, 2, 3], ['07-27', 3, 2, 3],
    ['08-10', 3, 3, 4], ['08-24', 3, 3, 4], ['09-07', 4, 3, 4], ['09-21', 4, 3, 4], ['10-05', 4, 3, 4]],
  lisa: [['05-02', 3, 3, 3], ['05-16', 3, 3, 4], ['05-30', 4, 3, 3], ['06-13', 4, 3, 4], ['06-29', 4, 3, 4], ['07-13', 4, 3, 4], ['07-27', 4, 3, 4],
    ['08-10', 5, 3, 4], ['08-24', 5, 4, 4], ['09-07', 5, 4, 4], ['09-21', 5, 4, 4], ['10-05', 5, 4, 4]],
}

// 1:1-scores (manager test@arno.bot), alleen de rijen met een agenda
const ONE_ON_ONE = {
  benny: { '2026-07-22': [3, 3, 4], '2026-08-19': [4, 3, 4], '2026-09-04': [4, 4, 5], '2026-09-22': [4, 4, 5], '2026-10-02': [3, 4, 5] },
  alira: { '2026-08-20': [3, 3, 4], '2026-09-04': [4, 3, 4], '2026-09-22': [4, 3, 4], '2026-10-02': [4, 3, 4] },
  lisa: { '2026-07-22': [4, 3, 4], '2026-08-19': [5, 3, 4], '2026-09-04': [5, 4, 4], '2026-09-22': [5, 4, 4], '2026-10-02': [5, 4, 4] },
}

// Coachingprofiel: huidige stand + richting (+ diagnoses die niet meer bij de score pasten)
const COACHING = {
  benny: { s: [3, 4, 5], richting: ['dalend', 'stabiel', 'stabiel'],
    mindset_diagnose: 'Doelgericht en veerkrachtig, maar zijn ongeduld stuurt nog te vaak zijn gedrag zodra een traject stilvalt. Hij herkent het steeds sneller, het is nog niet bewezen onder druk.' },
  alira: { s: [4, 3, 4], richting: ['stijgend', 'stabiel', 'stabiel'] },
  lisa: { s: [5, 4, 4], richting: ['stabiel', 'stijgend', 'stabiel'],
    actie_diagnose: 'Sterke executiekracht. Brengt het gesprek consequent terug naar de waarde die de klant zelf noemde, al aarzelt ze nog even bij de eerste kortingsvraag.' },
}

// Eerdere rapportages (ARCHIEF) die in de nieuwe reeks passen
const HISTORY = {
  benny: { '2026-08-05': [4, 3, 4], '2026-09-07': [4, 4, 5] },
  alira: { '2026-08-05': [3, 3, 4], '2026-09-07': [4, 3, 4] },
  lisa: { '2026-08-05': [5, 3, 4], '2026-09-07': [5, 4, 4] },
}

async function run() {
  const c = { scores: 0, oneOnOne: 0, coaching: 0, history: 0 }

  for (const [who, rows] of Object.entries(SERIES)) {
    for (const [md, m, s, a] of rows) {
      const { data, error } = await supabase.from('arnobot_coaching_scores')
        .update({ mindset_score: m, systeem_score: s, actie_score: a, msa_score: msa(m, s, a) })
        .eq('user_id', U[who]).gte('created_at', `2026-${md}T00:00:00+00:00`).lte('created_at', `2026-${md}T23:59:59+00:00`).select('id')
      if (error) throw new Error(`score ${who} ${md}: ${error.message}`)
      if (!data?.length) throw new Error(`score ${who} ${md}: geen rij gevonden`)
      c.scores += data.length
    }
  }

  for (const [who, dates] of Object.entries(ONE_ON_ONE)) {
    for (const [date, [m, s, a]] of Object.entries(dates)) {
      const { data, error } = await supabase.from('arnobot_1on1_log')
        .update({ mindset_score: m, systeem_score: s, actie_score: a })
        .eq('manager_id', ME).eq('member_id', U[who])
        .gte('created_at', `${date}T00:00:00+00:00`).lte('created_at', `${date}T23:59:59+00:00`).select('id')
      if (error) throw new Error(`1on1 ${who} ${date}: ${error.message}`)
      if (!data?.length) throw new Error(`1on1 ${who} ${date}: geen rij gevonden`)
      c.oneOnOne += data.length
    }
  }

  for (const [who, cfg] of Object.entries(COACHING)) {
    const [m, s, a] = cfg.s
    const update = {
      mindset_score: m, systeem_score: s, actie_score: a,
      mindset_richting: cfg.richting[0], systeem_richting: cfg.richting[1], actie_richting: cfg.richting[2],
    }
    if (cfg.mindset_diagnose) update.mindset_diagnose = cfg.mindset_diagnose
    if (cfg.actie_diagnose) update.actie_diagnose = cfg.actie_diagnose
    const { error } = await supabase.from('arnobot_coaching').update(update).eq('user_id', U[who])
    if (error) throw new Error(`coaching ${who}: ${error.message}`)
    c.coaching++
  }

  for (const [who, dates] of Object.entries(HISTORY)) {
    for (const [date, [m, s, a]] of Object.entries(dates)) {
      const { data, error } = await supabase.from('arnobot_coaching_history')
        .update({ mindset_score: m, systeem_score: s, actie_score: a })
        .eq('user_id', U[who]).gte('created_at', `${date}T00:00:00+00:00`).lte('created_at', `${date}T23:59:59+00:00`).select('id')
      if (error) throw new Error(`history ${who} ${date}: ${error.message}`)
      c.history += data?.length ?? 0
    }
  }

  console.log('Klaar.', JSON.stringify(c))
}

run().catch(err => { console.error(err); process.exit(1) })
