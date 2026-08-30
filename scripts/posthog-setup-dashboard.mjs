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
 *
 * Insights worden in het nieuwe query-formaat aangemaakt (InsightVizNode); PostHog
 * accepteert het oude "filters"-formaat niet meer via de API.
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

// EventsNode in het nieuwe query-formaat.
const node = (event, extra = {}) => ({ kind: 'EventsNode', event, name: event, math: 'total', ...extra })
const BOT_PATH = { key: '$pathname', value: '/bot', operator: 'icontains', type: 'event' }
const viz = source => ({ kind: 'InsightVizNode', source })

const trends = (series, { dateFrom = '-30d', display = 'ActionsLineGraph', breakdown } = {}) =>
  viz({
    kind: 'TrendsQuery',
    series,
    dateRange: { date_from: dateFrom },
    trendsFilter: { display },
    ...(breakdown ? { breakdownFilter: breakdown } : {}),
  })

const funnel = (series, dateFrom = '-90d') =>
  viz({ kind: 'FunnelsQuery', series, dateRange: { date_from: dateFrom }, funnelsFilter: { funnelVizType: 'steps' } })

const INSIGHTS = [
  {
    name: 'Activatie-funnel',
    description: 'Eerste /bot-pageview -> eerste gesprek afgerond -> sessiesynthese -> coachingsynthese',
    query: funnel([node('$pageview', { properties: [BOT_PATH] }), node('gesprek_afgerond'), node('sessie_synthese_getoond'), node('coaching_synthese_getoond')]),
  },
  {
    name: 'Gesprekken afgerond per dag',
    query: trends([node('gesprek_afgerond')]),
  },
  {
    name: 'Coaching: gestart vs. synthese getoond',
    description: 'Verschil = mensen die coaching starten maar geen synthese krijgen (geblokkeerd of afgehaakt)',
    query: trends([node('coaching_gestart'), node('coaching_synthese_getoond')]),
  },
  {
    name: 'Sparren gestart per rol',
    query: trends([node('sparren_gestart')], { display: 'ActionsBar', breakdown: { breakdown: 'rol', breakdown_type: 'event' } }),
  },
  {
    name: 'Feature-adoptie (pageviews per /bot-pad)',
    query: trends([node('$pageview', { properties: [BOT_PATH] })], { display: 'ActionsBarValue', breakdown: { breakdown: '$pathname', breakdown_type: 'event' } }),
  },
  {
    name: 'Upgrade-CTA geklikt per plan',
    query: trends([node('upgrade_cta_geklikt')], { dateFrom: '-90d', breakdown: { breakdown: 'plan', breakdown_type: 'event' } }),
  },
  {
    name: 'Opzeggingen',
    query: trends([node('opzegging_gestart')], { dateFrom: '-90d' }),
  },
  {
    name: 'Team: uitgenodigd vs. geactiveerd',
    query: trends([node('teamlid_uitgenodigd'), node('teamlid_geactiveerd')], { dateFrom: '-90d' }),
  },
  {
    name: 'Team: 1:1-agenda en spotlight gegenereerd',
    query: trends([node('team_1on1_gegenereerd'), node('team_spotlight_bekeken')], { dateFrom: '-90d' }),
  },
  {
    name: 'Actieve gebruikers per plan',
    query: trends([node('$pageview', { math: 'dau', properties: [BOT_PATH] })], { breakdown: { breakdown: 'plan', breakdown_type: 'person' } }),
  },
  {
    name: 'Wekelijkse retentie (/bot-pageview)',
    query: viz({
      kind: 'RetentionQuery',
      retentionFilter: {
        targetEntity: { id: '$pageview', name: '$pageview', type: 'events' },
        returningEntity: { id: '$pageview', name: '$pageview', type: 'events' },
        period: 'Week',
        retentionType: 'retention_first_time',
        totalIntervals: 12,
      },
    }),
  },
]

async function main() {
  const existing = await api('/dashboards/?limit=200')
  let dashboard = (existing.results || []).find(d => d.name === DASHBOARD_NAME)
  if (dashboard) {
    console.log(`Dashboard "${DASHBOARD_NAME}" bestaat al (id ${dashboard.id}).`)
  } else {
    dashboard = await api('/dashboards/', 'POST', {
      name: DASHBOARD_NAME,
      description: 'Productgebruik van de ingelogde app: activatie, adoptie, conversie, team. Aangemaakt via scripts/posthog-setup-dashboard.mjs.',
    })
    console.log(`Dashboard aangemaakt: id ${dashboard.id}`)
  }

  // Welke insights hangen er al aan (op naam), zodat re-run niks dubbel doet.
  const tiles = await api(`/dashboards/${dashboard.id}/`)
  const alreadyThere = new Set((tiles.tiles || []).map(t => t.insight?.name).filter(Boolean))

  for (const ins of INSIGHTS) {
    if (alreadyThere.has(ins.name)) { console.log(`  = ${ins.name} (bestond al)`); continue }
    await api('/insights/', 'POST', { ...ins, dashboards: [dashboard.id] })
    console.log(`  + ${ins.name}`)
  }

  if (REPORT_EMAIL) {
    try {
      const subs = await api('/subscriptions/?limit=100')
      const hasSub = (subs.results || []).some(s => s.dashboard === dashboard.id && (s.target_value || '').includes(REPORT_EMAIL))
      if (hasSub) {
        console.log(`  = wekelijkse mail naar ${REPORT_EMAIL} bestond al`)
      } else {
        await api('/subscriptions/', 'POST', {
          dashboard: dashboard.id,
          target_type: 'email',
          target_value: REPORT_EMAIL,
          frequency: 'weekly',
          interval: 1,
          start_date: new Date().toISOString(),
          title: 'ArnoBot Product, wekelijks',
        })
        console.log(`  + wekelijkse mail-samenvatting naar ${REPORT_EMAIL}`)
      }
    } catch (e) {
      console.log(`  ! mail-abonnement via de API mislukt (${String(e.message).split('\n')[0]}).`)
      console.log(`    Zet het handmatig: open het dashboard -> knop "Subscribe" -> wekelijks.`)
    }
  } else {
    console.log('  (geen POSTHOG_REPORT_EMAIL gezet, dus geen mail-abonnement; kan later in de UI via "Subscribe")')
  }

  console.log(`\nKlaar: ${HOST}/project/${PROJECT_ID}/dashboard/${dashboard.id}`)
}

main().catch(e => { console.error(e.message || e); process.exit(1) })
