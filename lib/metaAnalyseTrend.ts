import type { SupabaseClient } from '@supabase/supabase-js'

// Gedeeld tussen app/api/cron/meta-analyse en app/api/admin/meta-analyse zodat de
// trendvergelijking in beide identiek is en niet opnieuw uit elkaar kan lopen zoals
// de rest van die twee routes wel is gebeurd.

export type BevindingErnst = 'hoog' | 'midden' | 'laag'
export type BevindingTrend = 'nieuw' | 'verbeterd' | 'gelijk' | 'verslechterd'

export interface Bevinding {
  slug: string
  label: string
  ernst: BevindingErnst
  trend: BevindingTrend
  toelichting: string
}

export interface VorigeAnalyse {
  datumLabel: string
  sessionCount: number
  expertpanelText: string
  zelfbeoordelingText: string
  bevindingen: Bevinding[]
}

// Het expertpanel sluit zijn antwoord af met een machineleesbaar blok (zie
// BEVINDINGEN_INSTRUCTIE). Dit haalt dat blok eruit zodat de admin-UI er een trend-
// tabel van kan maken en de vorige slugs teruggevoerd kunnen worden voor labelstabiliteit.
// Bewust in de bestaande tekstkolom i.p.v. een aparte kolom: geen migratie nodig, en het
// blok is triviaal te migreren zodra er wel een kolom komt.
const BEVINDINGEN_RE = /<<BEVINDINGEN>>([\s\S]*?)<<EINDE>>/

export function parseBevindingen(expertpanelText: string): Bevinding[] {
  const m = expertpanelText.match(BEVINDINGEN_RE)
  if (!m) return []
  const geldigeErnst: BevindingErnst[] = ['hoog', 'midden', 'laag']
  const geldigeTrend: BevindingTrend[] = ['nieuw', 'verbeterd', 'gelijk', 'verslechterd']
  return m[1]
    .split('\n')
    .map(r => r.trim())
    .filter(Boolean)
    .map(regel => {
      const delen = regel.split('|').map(d => d.trim())
      if (delen.length < 4) return null
      // Nieuw formaat: slug | label | ernst | trend | toelichting.
      // Oud formaat (backfill vóór 2026-09-02): slug | ernst | trend | toelichting.
      const heeftLabel = delen.length >= 5 && !geldigeErnst.includes(delen[1] as BevindingErnst)
      const slug = delen[0].toLowerCase().replace(/[^a-z0-9_]/g, '')
      const label = heeftLabel && delen[1] ? delen[1] : slug.replace(/_/g, ' ')
      const ernstRaw = heeftLabel ? delen[2] : delen[1]
      const trendRaw = heeftLabel ? delen[3] : delen[2]
      const toelichting = heeftLabel ? (delen[4] ?? '') : (delen[3] ?? '')
      const ernst = geldigeErnst.includes(ernstRaw as BevindingErnst) ? ernstRaw as BevindingErnst : 'midden'
      const trend = geldigeTrend.includes(trendRaw as BevindingTrend) ? trendRaw as BevindingTrend : 'gelijk'
      if (!slug) return null
      return { slug, label, ernst, trend, toelichting }
    })
    .filter((b): b is Bevinding => b !== null)
    .slice(0, 6)
}

// Het bevindingen-blok uit de weergegeven tekst halen (UI en e-mail tonen het niet rauw).
export function stripBevindingenBlok(text: string): string {
  return text.replace(BEVINDINGEN_RE, '').replace(/\n{3,}$/, '\n').trimEnd()
}

// Meest recente eerdere meta-analyse, voor de trendvergelijking. null als er nog geen is.
export async function fetchVorigeAnalyse(supabase: SupabaseClient): Promise<VorigeAnalyse | null> {
  const { data } = await supabase
    .from('arnobot_meta_analyses')
    .select('created_at, session_count, expertpanel_text, zelfbeoordeling_text')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data?.expertpanel_text) return null
  return {
    datumLabel: new Date(data.created_at).toLocaleDateString('nl-NL', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam',
    }),
    sessionCount: data.session_count,
    expertpanelText: data.expertpanel_text,
    zelfbeoordelingText: data.zelfbeoordeling_text ?? '',
    bevindingen: parseBevindingen(data.expertpanel_text),
  }
}

export function vorigPanelBlok(v: VorigeAnalyse | null): string {
  if (!v) return ''
  const slugs = v.bevindingen.length > 0
    ? `\n\nDe bevindingen uit de vorige analyse (hergebruik exact dezelfde slug en hetzelfde label voor hetzelfde punt):\n${v.bevindingen.map(b => `${b.slug} | ${b.label} | ${b.ernst} | ${b.toelichting}`).join('\n')}`
    : ''
  return `\n\nVORIGE ANALYSE (${v.datumLabel}, ${v.sessionCount} gesprekken). Gebruik dit uitsluitend om de trend te bepalen, laat het je oordeel over de gesprekken van nu er niet door kleuren.\n\n${stripBevindingenBlok(v.expertpanelText)}${slugs}`
}

export function vorigZelfBlok(v: VorigeAnalyse | null): string {
  if (!v) return ''
  return `\n\nJE VORIGE ZELFBEOORDELING (${v.datumLabel}, ${v.sessionCount} gesprekken), uitsluitend om de trend te bepalen:\n\n${v.zelfbeoordelingText}`
}

export const TREND_PANEL_INSTRUCTIE = `\n\nTREND SINDS VORIGE KEER\nLoop de kritische punten uit de vorige analyse langs. Per punt: beter, gelijk of slechter deze maand, met een concreet voorbeeld uit de gesprekken van nu. Sluit af met welke punten hardnekkig blijven terugkomen.`

export const TREND_ZELF_INSTRUCTIE = `\n\nBij WAT IK ZOU VERBETEREN: leg de aanbevelingen van de vorige keer ernaast. Welke zijn echt opgevolgd, welke niet, en waar is dat terug te zien in de gesprekken van nu?`

// Machineleesbaar blok helemaal aan het eind van het panel-antwoord, voor de trend-tabel
// in de admin-UI. Slugs met underscores (geen streepjes) zodat de streepjesregel niet in
// het geding komt en parsing eenduidig blijft.
export const BEVINDINGEN_INSTRUCTIE = `\n\nSluit je HELE antwoord af met exact dit machineleesbare blok, niets erna:\n<<BEVINDINGEN>>\nslug | label | ernst | trend | toelichting van één zin\n<<EINDE>>\nEén regel per structureel verbeterpunt uit je oordeel, maximaal zes, belangrijkste eerst. Precies vijf velden per regel, gescheiden door " | ". Regels:\nslug: kort, kleine letters, alleen letters/cijfers/underscores, bijvoorbeeld verifieren_voor_advies. Hergebruik EXACT de slug uit de vorige analyse als het over hetzelfde punt gaat. Alleen een echt nieuw punt krijgt een nieuwe slug.\nlabel: 2 tot 5 woorden, leesbare titel voor het punt, geen underscores. Hergebruik het label van de vorige analyse als de slug hetzelfde is.\nernst: hoog, midden of laag.\ntrend: nieuw, verbeterd, gelijk of verslechterd ten opzichte van de vorige analyse (nieuw als er geen vorige is of het punt niet eerder voorkwam).\ntoelichting: één korte zin, geen streepjes als leesteken, geen verticale streep.`
