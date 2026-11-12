import { createClient } from '@supabase/supabase-js'

// Service-role client voor de billing-tabellen. De tabellen staan niet in types/supabase.ts
// (nog niet gegenereerd), dus hier bewust een ongetypeerde client met eigen rij-types.
export const billingDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export type SubStatus = 'pending' | 'active' | 'cancelled' | 'ended' | 'refunded' | 'abandoned'

export interface SubRow {
  id: string
  user_id: string
  plan: 'basis' | 'premium'
  cyclus: 'maandelijks' | 'jaarlijks'
  klant_type: 'particulier' | 'zakelijk'
  status: SubStatus
  bedrag_cent: number
  btw_cent: number
  mollie_customer_id: string
  mollie_subscription_id: string | null
  mollie_sub_geannuleerd_at: string | null
  periode_start: string | null
  periode_einde: string | null
  contract_einde: string | null
  opzegging_aangevraagd_at: string | null
  opzegging_ingaat_at: string | null
  herinnering_30_at: string | null
  herinnering_7_at: string | null
  einde_mail_at: string | null
  // Geplande wijziging (docs/OVERSTAP_PLAN.md, docs/sql/2026-11-12-overstap-geplande-wijziging.sql).
  // Optioneel: de kolommen bestaan pas na de SQL-migratie, en leeg betekent "niets gepland".
  gepland_plan?: 'basis' | 'premium' | null
  gepland_cyclus?: 'maandelijks' | 'jaarlijks' | null
  gepland_bedrag_cent?: number | null
  gepland_btw_cent?: number | null
  gepland_mollie_subscription_id?: string | null
  gepland_mollie_sub_geannuleerd_at?: string | null
  gepland_ingangs_at?: string | null
  gepland_at?: string | null
  created_at?: string
}

export interface PayRow {
  id: string
  user_id: string
  subscription_id: string | null
  mollie_payment_id: string
  soort: 'eerste' | 'herhaling' | 'verlenging' | 'upgrade'
  status: string
  bedrag_cent: number
  btw_cent: number
  terugbetaald_cent: number
  teruggeboekt_cent: number
  betaald_at: string | null
  verwerkt_at: string | null
  terugbetaling_verwerkt_at: string | null
  moneybird_factuur_id: string | null
}
