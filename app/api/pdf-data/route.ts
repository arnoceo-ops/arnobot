import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const SECTIONS = {
  strategie: [
    { id: 'missie', label: 'MISSIE' },
    { id: 'cultuur_1', label: 'CULTUUR 1' },
    { id: 'cultuur_2', label: 'CULTUUR 2' },
    { id: 'cultuur_3', label: 'CULTUUR 3' },
    { id: 'cultuur_4', label: 'CULTUUR 4' },
    { id: 'cultuur_5', label: 'CULTUUR 5' },
    { id: 'waardepropositie', label: 'WAARDEPROPOSITIE' },
    { id: 'kerncompetenties', label: 'KERNCOMPETENTIES' },
    { id: 'dienstverlening', label: 'DIENSTVERLENING' },
    { id: 'zandbak', label: 'ZANDBAK' },
    { id: 'doelen_omzet', label: 'DOELEN — Omzet €' },
    { id: 'doelen_winst', label: 'DOELEN — Winst €' },
    { id: 'doelen_klanten', label: 'DOELEN — Klanten #' },
    { id: 'doelen_marktaandeel', label: 'DOELEN — Marktaandeel %' },
    { id: 'doelen_liquiditeit', label: 'DOELEN — Liquiditeit %' },
    { id: 'acties_omzet', label: 'ACTIES — Omzet €' },
    { id: 'acties_winst', label: 'ACTIES — Winst €' },
    { id: 'acties_klanten', label: 'ACTIES — Klanten #' },
    { id: 'acties_brutomarge', label: 'ACTIES — Brutomarge %' },
    { id: 'acties_cash', label: 'ACTIES — Cash €' },
    { id: 'leiderschap_markt', label: 'LEIDERSCHAP — Markt' },
    { id: 'leiderschap_wanneer', label: 'LEIDERSCHAP — Wanneer' },
    { id: 'merkbelofte', label: 'MERKBELOFTE' },
    { id: 'strategie_in_1_zin', label: 'STRATEGIE IN 1 ZIN' },
    { id: 'onderscheidend_1', label: 'ONDERSCHEIDEND 1' },
    { id: 'onderscheidend_2', label: 'ONDERSCHEIDEND 2' },
    { id: 'onderscheidend_3', label: 'ONDERSCHEIDEND 3' },
    { id: 'onderscheidend_4', label: 'ONDERSCHEIDEND 4' },
    { id: 'onderscheidend_5', label: 'ONDERSCHEIDEND 5' },
    { id: 'xfactor', label: 'X-FACTOR' },
    { id: 'winst_per_eenheid', label: 'WINST PER EENHEID' },
    { id: 'moonshot_1', label: 'MOONSHOT 1' },
    { id: 'moonshot_2', label: 'MOONSHOT 2' },
    { id: 'moonshot_3', label: 'MOONSHOT 3' },
    { id: 'moonshot_4', label: 'MOONSHOT 4' },
    { id: 'moonshot_5', label: 'MOONSHOT 5' },
    { id: 'schaalbaarheid', label: 'SCHAALBAARHEID' },
    { id: 'repeterende_omzet', label: 'REPETERENDE OMZET' },
    { id: 'klantretentie', label: 'KLANTRETENTIE' },
    { id: 'referrals', label: 'REFERRALS' },
    { id: 'omtm', label: 'OMTM' },
  ],
  mensen: [
    { id: 'leider_naam', label: 'LEIDER' },
    { id: 'leider_rol', label: 'ROL VAN DE LEIDER' },
    { id: 'topteam_1', label: 'TOPTEAM 1' },
    { id: 'topteam_2', label: 'TOPTEAM 2' },
    { id: 'topteam_3', label: 'TOPTEAM 3' },
    { id: 'topteam_4', label: 'TOPTEAM 4' },
    { id: 'topteam_5', label: 'TOPTEAM 5' },
    { id: 'salesteam_structuur', label: 'SALESTEAM STRUCTUUR' },
    { id: 'rollen_verantwoordelijkheden', label: 'ROLLEN & VERANTWOORDELIJKHEDEN' },
    { id: 'aanname_criteria', label: 'AANNAME CRITERIA' },
    { id: 'onboarding', label: 'ONBOARDING' },
    { id: 'training_ontwikkeling', label: 'TRAINING & ONTWIKKELING' },
    { id: 'compensatie_model', label: 'COMPENSATIE MODEL' },
    { id: 'targets_kpi', label: "TARGETS & KPI'S" },
    { id: 'performance_management', label: 'PERFORMANCE MANAGEMENT' },
    { id: 'cultuur_energie', label: 'CULTUUR & ENERGIE' },
    { id: 'retentie_talent', label: 'RETENTIE TALENT' },
    { id: 'zwakste_schakel', label: 'ZWAKSTE SCHAKEL' },
    { id: 'ideale_teamgrootte', label: 'IDEALE TEAMGROOTTE' },
    { id: 'externe_partners', label: 'EXTERNE PARTNERS' },
    { id: 'succession_plan', label: 'SUCCESSION PLAN' },
  ],
  uitvoering: [
    { id: 'salesproces', label: 'SALESPROCES' },
    { id: 'pipeline_fases', label: 'PIPELINE FASES' },
    { id: 'leadgeneratie', label: 'LEADGENERATIE' },
    { id: 'kwalificatie', label: 'KWALIFICATIE' },
    { id: 'gemiddelde_dealgrootte', label: 'GEMIDDELDE DEALGROOTTE' },
    { id: 'gemiddelde_salescyclus', label: 'GEMIDDELDE SALESCYCLUS' },
    { id: 'conversieratio', label: 'CONVERSIERATIO' },
    { id: 'prioriteit_accounts', label: 'PRIORITEIT ACCOUNTS' },
    { id: 'tools_crm', label: 'TOOLS & CRM' },
    { id: 'grootste_bottleneck', label: 'GROOTSTE BOTTLENECK' },
    { id: 'kpi_omzet', label: 'KPI — Omzet' },
    { id: 'kpi_nieuwe_klanten', label: 'KPI — Nieuwe Klanten' },
    { id: 'kpi_churn', label: 'KPI — Churn' },
    { id: 'kpi_nps', label: 'KPI — NPS' },
    { id: 'kpi_winst', label: 'KPI — Winst' },
    { id: 'groei_hefboom', label: 'GROEI HEFBOOM' },
    { id: 'quick_wins', label: 'QUICK WINS' },
    { id: 'strategische_projecten', label: 'STRATEGISCHE PROJECTEN' },
    { id: 'risicos', label: "RISICO'S" },
    { id: 'actieplan_90_dagen', label: 'ACTIEPLAN 90 DAGEN' },
  ],
}

const ALL_TOTAL = 82

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  void req

  // Haal alle antwoorden op
  const { data: answers } = await supabase
    .from('canvas_answers')
    .select('question_id, answer')
    .eq('user_id', userId)

  const answerMap: Record<string, string> = {}
  answers?.forEach(a => { answerMap[a.question_id] = a.answer })

  const filled = answers?.filter(a => a.answer?.trim()).length || 0
  const healthScore = Math.round((filled / ALL_TOTAL) * 100)

  // Bouw JSON response voor client-side PDF generatie
  const result = {
    healthScore,
    filled,
    total: ALL_TOTAL,
    exportedAt: new Date().toISOString(),
    sections: {
      strategie: SECTIONS.strategie.map(f => ({
        label: f.label,
        answer: answerMap[`strategie_${f.id}`] || '',
      })),
      mensen: SECTIONS.mensen.map(f => ({
        label: f.label,
        answer: answerMap[`mensen_${f.id}`] || '',
      })),
      uitvoering: SECTIONS.uitvoering.map(f => ({
        label: f.label,
        answer: answerMap[`uitvoering_${f.id}`] || '',
      })),
    },
  }

  return NextResponse.json(result)
}
