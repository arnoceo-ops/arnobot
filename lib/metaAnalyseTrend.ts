import type { SupabaseClient } from '@supabase/supabase-js'

// Gedeeld tussen app/api/cron/meta-analyse en app/api/admin/meta-analyse zodat de
// trendvergelijking in beide identiek is en niet opnieuw uit elkaar kan lopen zoals
// de rest van die twee routes wel is gebeurd.

export interface VorigeAnalyse {
  datumLabel: string
  sessionCount: number
  expertpanelText: string
  zelfbeoordelingText: string
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
  }
}

export function vorigPanelBlok(v: VorigeAnalyse | null): string {
  if (!v) return ''
  return `\n\nVORIGE ANALYSE (${v.datumLabel}, ${v.sessionCount} gesprekken). Gebruik dit uitsluitend om de trend te bepalen, laat het je oordeel over de gesprekken van nu er niet door kleuren.\n\n${v.expertpanelText}`
}

export function vorigZelfBlok(v: VorigeAnalyse | null): string {
  if (!v) return ''
  return `\n\nJE VORIGE ZELFBEOORDELING (${v.datumLabel}, ${v.sessionCount} gesprekken), uitsluitend om de trend te bepalen:\n\n${v.zelfbeoordelingText}`
}

export const TREND_PANEL_INSTRUCTIE = `\n\nTREND SINDS VORIGE KEER\nLoop de kritische punten uit de vorige analyse langs. Per punt: beter, gelijk of slechter deze maand, met een concreet voorbeeld uit de gesprekken van nu. Sluit af met welke punten hardnekkig blijven terugkomen.`

export const TREND_ZELF_INSTRUCTIE = `\n\nBij WAT IK ZOU VERBETEREN: leg de aanbevelingen van de vorige keer ernaast. Welke zijn echt opgevolgd, welke niet, en waar is dat terug te zien in de gesprekken van nu?`
