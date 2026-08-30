#!/usr/bin/env node
/**
 * Maakt het "ArnoBot Product"-dashboard in PostHog aan met een vaste set insights.
 * Eenmalig draaien. Idempotent: bestaat het dashboard al (zelfde naam), dan stopt het
 * script zonder iets te wijzigen.
 *
 * Gebruik:
 *   POSTHOG_PERSONAL_API_KEY=phx_xxx node scripts/posthog-setup-dashboard.mjs
 *
 * Optioneel een wekelijkse mail-samenvatting van het dashboard:
 *   POSTHOG_PERSONAL_API_KEY=phx_xxx POSTHOG_REPORT_EMAIL=jij@voorbeeld.nl node scripts/posthog-setup-dashboard.mjs
 *
 * De personal API key maak je in PostHog: Settings -> Personal API keys -> Create.
 * Scopes: insight:write, dashboard:write (subscription:write als je de mail wilt).
 * Je mag de key daarna weer intrekken; het dashboard blijft bestaan.
 */

const HOST = 'https://eu.posthog.com'
const PROJECT_ID = 238288
const DASHBOARD_NAME = 'ArnoBot Product'

const KEY = process.env.POSTHOG_PERSONAL_API_KEY
if (!KEY) {
  console.error('Ontbreekt: POSTHOG_PERSONAL_API_KEY. Zie de comment bovenin dit bestand.')
  process.exit(1)
}
const REPORT_EMAIL = process.env.POSTHOG_REPORT_EMAIL || null

async function api(path, method = 'GET', body) {
  const res = await fetch(`${HOST}/api/projects/${PROJECT_ID}${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = text }
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}\n${typeof json === 'string' ? json : JSON.stringify(json, null, 2)}`)
  }
  return json
}

// Een event-stap in het legacy filters-formaat (PostHog converteert dit zelf naar het
// nieuwe query-formaat bij het inlezen; blijft backward compatible).
const ev = (id, order = 0, extra = {}) => ({ id, name: id, type: 'events', order, ...extra })

const BOT_PATH = { key: '$pathname', value: '/bot', operator: 'icontains', type: 'event' }

const INSIGHTS = [
  {
    name: 'Activatie-funnel',
    description: 'Pageview -> eerste gesprek afgerond -> sessiesynthese -> coachingsynthese',
    filters: {
      insight: 'FUNNELS',
      events: [ev('$pageview', 0), ev('gesprek_afgerond', 1), ev('sessie_synthese_getoond', 2), ev('coaching_synthese_getoond', 3)],
      date_from: '-90d',
      funnel_viz_type: 'steps',
    },
  },
  {
    name: 'Gesprekken afgerond per dag',
    filters: { insight: 'TRENDS', events: [ev('gesprek_afgerond')], date_from: '-30d', display: 'ActionsLineGraph' },
  },
  {
    name: 'Coaching: gestart vs. synthese getoond',
    description: 'Verschil = mensen die coaching starten maar geen synthese krijgen (geblokkeerd of afgehaakt)',
    filters: { insight: 'TRENDS', events: [ev('coaching_gestart', 0), ev('coaching_synthese_getoond', 1)], date_from: '-30d', display: 'ActionsLineGraph' },
  },
  {
    name: 'Sparren gestart per rol',
    filters: { insight: 'TRENDS', events: [ev('sparren_gestart')], date_from: '-30d', display: 'ActionsBar', breakdown: 'rol', breakdown_type: 'event' },
  },
  {
    name: 'Feature-adoptie (pageviews per /bot-pad)',
    filters: { insight: 'TRENDS', events: [ev('$pageview', 0, { properties: [BOT_PATH] })], date_from: '-30d', display: 'ActionsBarValue', breakdown: '$pathname', breakdown_type: 'event' },
  },
  {
    name: 'Upgrade-CTA geklikt per plan',
    filters: { insight: 'TRENDS', events: [ev('upgrade_cta_geklikt')], date_from: '-90d', display: 'ActionsLineGraph', breakdown: 'plan', breakdown_type: 'event' },
  },
  {
    name: 'Opzeggingen',
    filters: { insight: 'TRENDS', events: [ev('opzegging_gestart')], date_from: '-90d', display: 'ActionsLineGraph' },
  },
  {
    name: 'Team: uitgenodigd vs. geactiveerd',
    filters: { insight: 'TRENDS', events: [ev('teamlid_uitgenodigd', 0), ev('teamlid_geactiveerd', 1)], date_from: '-90d', display: 'ActionsLineGraph' },
  },
  {
    name: 'Team: 1:1-agenda en spotlight gegenereerd',
    filters: { insight: 'TRENDS', events: [ev('team_1on1_gegenereerd', 0), ev('team_spotlight_bekeken', 1)], date_from: '-90d', display: 'ActionsLineGraph' },
  },
  {
    name: 'Actieve gebruikers per plan',
    filters: {
      insight: 'TRENDS',
      events: [ev('$pageview', 0, { math: 'dau', properties: [BOT_PATH] })],
      date_from: '-30d',
      display: 'ActionsLineGraph',
      breakdown: 'plan',
      breakdown_type: 'person',
    },
  },
  {
    name: 'Wekelijkse retentie (/bot-pageview)',
    filters: {
      insight: 'RETENTION',
      target_entity: { id: '$pageview', type: 'events' },
      returning_entity: { id: '$pageview', type: 'events' },
      period: 'Week',
      retention_type: 'retention_first_time',
      date_from: '-12w',
    },
  },
]

async function main() {
  const existing = await api('/dashboards/?limit=200')
  const dupe = (existing.results || []).find(d => d.name === DASHBOARD_NAME)
  if (dupe) {
    console.log(`Dashboard "${DASHBOARD_NAME}" bestaat al (id ${dupe.id}). Niks gedaan.`)
    console.log(`${HOST}/project/${PROJECT_ID}/dashboard/${dupe.id}`)
    return
  }

  const dashboard = await api('/dashboards/', 'POST', {
    name: DASHBOARD_NAME,
    description: 'Productgebruik van de ingelogde app: activatie, adoptie, conversie, team. Aangemaakt via scripts/posthog-setup-dashboard.mjs.',
  })
  console.log(`Dashboard aangemaakt: id ${dashboard.id}`)

  for (const ins of INSIGHTS) {
    await api('/insights/', 'POST', { ...ins, dashboards: [dashboard.id] })
    console.log(`  + ${ins.name}`)
  }

  if (REPORT_EMAIL) {
    await api('/subscriptions/', 'POST', {
      dashboard: dashboard.id,
      target_type: 'email',
      target_value: REPORT_EMAIL,
      frequency: 'weekly',
      interval: 1,
      start_date: new Date().toISOString(),
      title: 'ArnoBot Product, wekelijks',
    })
    console.log(`  wekelijkse mail-samenvatting naar ${REPORT_EMAIL}`)
  } else {
    console.log('  (geen POSTHOG_REPORT_EMAIL gezet, dus geen mail-abonnement; kan later in de UI via "Subscribe")')
  }

  console.log(`\nKlaar: ${HOST}/project/${PROJECT_ID}/dashboard/${dashboard.id}`)
}

main().catch(e => { console.error(e.message || e); process.exit(1) })
