import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import React from 'react'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const s = StyleSheet.create({
  page: { backgroundColor: '#ffffff', padding: '48 52', fontFamily: 'Helvetica', fontSize: 10, color: '#1f2937' },

  // Titels
  docTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#111827', marginBottom: 4 },
  docMeta:  { fontSize: 9, color: '#6b7280', marginBottom: 20 },
  hr:       { borderBottomWidth: 1, borderBottomColor: '#d1d5db', marginBottom: 20 },
  hrThick:  { borderBottomWidth: 2, borderBottomColor: '#111827', marginTop: 4, marginBottom: 20 },

  // Sectiekoppen
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginTop: 8 },
  sectionIcon: { fontSize: 13, marginRight: 6 },
  sectionTitle:{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#111827' },

  subHead: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#111827', marginTop: 10, marginBottom: 6 },

  // Checkboxen
  row:      { flexDirection: 'row', marginBottom: 5, alignItems: 'flex-start' },
  checkbox: { width: 14, fontSize: 10, color: '#16a34a', marginRight: 5, marginTop: 1 },
  checkboxEmpty: { width: 14, fontSize: 10, color: '#9ca3af', marginRight: 5, marginTop: 1 },
  rowText:  { flex: 1, fontSize: 9.5, lineHeight: 1.55, color: '#374151' },
  bold:     { fontFamily: 'Helvetica-Bold' },
  code:     { fontFamily: 'Courier', fontSize: 8.5, backgroundColor: '#f3f4f6', color: '#111827' },

  // Tabel
  table:    { marginTop: 8, marginBottom: 4 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingVertical: 6 },
  tableHead:{ flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: '#111827', paddingBottom: 5, marginBottom: 2 },
  col1:     { width: '38%', fontSize: 9.5, color: '#374151' },
  col2:     { width: '62%', fontSize: 9.5, color: '#374151' },
  colHead:  { fontFamily: 'Helvetica-Bold', fontSize: 9.5, color: '#111827' },

  // Header test block
  termBlock: { backgroundColor: '#f8fafc', border: '1 solid #e2e8f0', borderRadius: 4, padding: '8 10', marginTop: 8 },
  termRow:   { flexDirection: 'row', marginBottom: 3 },
  termCheck: { width: 14, fontSize: 9, color: '#16a34a' },
  termCross: { width: 14, fontSize: 9, color: '#dc2626' },
  termText:  { fontSize: 8.5, fontFamily: 'Courier', color: '#374151' },

  footer: { position: 'absolute', bottom: 32, left: 52, right: 52, borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7.5, color: '#9ca3af', fontStyle: 'italic' },
})

const DATE = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })

function el(type, props, ...children) { return React.createElement(type, props, ...children) }

function Check(text, bold) {
  const parts = bold ? text.split(bold) : null
  return el(View, { style: s.row },
    el(Text, { style: s.checkbox }, '☑'),
    parts
      ? el(Text, { style: s.rowText }, el(Text, { style: s.bold }, bold), parts[1])
      : el(Text, { style: s.rowText }, text)
  )
}

function Todo(text, bold) {
  const parts = bold ? text.split(bold) : null
  return el(View, { style: s.row },
    el(Text, { style: s.checkboxEmpty }, '☐'),
    parts
      ? el(Text, { style: s.rowText }, el(Text, { style: s.bold }, bold), parts[1])
      : el(Text, { style: s.rowText }, text)
  )
}

function Sub(title) {
  return el(Text, { style: s.subHead }, title)
}

function HR() { return el(View, { style: s.hr }) }

function SectionHead(icon, title) {
  return el(View, { style: s.sectionHead },
    el(Text, { style: s.sectionIcon }, icon),
    el(Text, { style: s.sectionTitle }, title)
  )
}

function TableRow(col1, col2, isHead) {
  return el(View, { style: isHead ? s.tableHead : s.tableRow },
    el(Text, { style: [s.col1, isHead && s.colHead] }, col1),
    el(Text, { style: [s.col2, isHead && s.colHead] }, col2),
  )
}

const doc = el(Document, { title: 'ArnoBot — Security Launch Checklist', author: 'ArnoBot' },
  el(Page, { size: 'A4', style: s.page },

    // Titel
    el(Text, { style: s.docTitle }, 'ArnoBot — Security Launch Checklist'),
    el(Text, { style: s.docMeta }, `Versie: 1.0  |  Datum: ${DATE}`),
    el(View, { style: s.hrThick }),

    // ── SECTIE 1: AL GEREGELD ──────────────────────────
    SectionHead('✅', 'Al geregeld (bestaande stack)'),

    Check('Clerk authenticatie — LinkedIn OAuth, geen eigen wachtwoordopslag', 'Clerk authenticatie'),
    Check('Supabase RLS — Row Level Security actief op alle tabellen', 'Supabase RLS'),
    Check('Service role key server-side — nooit blootgesteld aan de client', 'Service role key server-side'),
    Check('Admin-toegang — httpOnly cookie + aparte roteerbare sleutel', 'Admin-toegang'),
    Check('CRON_SECRET — alle cron-routes vereisen geheime header', 'CRON_SECRET'),
    Check('Vercel Edge — DDoS-bescherming op netwerkniveau ingebouwd', 'Vercel Edge'),
    Check('HTTPS — Vercel dwingt SSL af op alle domeinen', 'HTTPS'),
    Check('Middleware sessievalidatie — Clerk JWT gecontroleerd op alle beveiligde routes', 'Middleware sessievalidatie'),

    el(View, { style: s.hr }),

    // ── SECTIE 2: NIEUW ──────────────────────────────
    SectionHead('🆕', 'Nieuw toegevoegd (deze sessie)'),

    Sub('Auth & IDOR-fixes'),
    Check('IDOR gedicht op /api/pdf-data — userId uit sessie, niet uit query param', 'IDOR gedicht'),
    Check('/api/bot/verfijn — Clerk auth toegevoegd (was volledig open)', '/api/bot/verfijn'),
    Check('/api/bot/team/join GET — vereist nu login', '/api/bot/team/join GET'),
    Check('Manager-check in /api/bot/team/1on1 — zelfde team vereist', 'Manager-check'),

    Sub('Rate Limiting'),
    Check('Hoofdchat: max 5 verzoeken/min per IP (via Supabase logtabellen)', 'Hoofdchat:'),
    Check('Admin-login: max 10 pogingen/15 min per IP + 500ms vertraging', 'Admin-login:'),
    Check('Team join: maximaal 25 leden per team', 'Team join:'),

    Sub('Security Headers'),
    Check('next.config.ts bijgewerkt: X-Frame-Options, HSTS, CSP, Referrer-Policy, Permissions-Policy', 'next.config.ts bijgewerkt:'),
    Check('poweredByHeader: false (verbergt Next.js versie)', 'poweredByHeader: false'),

    Sub('Input Sanitatie & Injectiebeveiliging'),
    Check('detectPromptInjection() — 14 regex-patronen (NL + EN) in hoofdchat', 'detectPromptInjection()'),
    Check('Berichtlengte-limieten: chat max 4.000 tekens, history max 40 items', 'Berichtlengte-limieten:'),
    Check('Sparring-limieten: bericht max 2.000, context max 500, history max 40', 'Sparring-limieten:'),
    Check('Feedback max 2.000 tekens, gesanitized voor Telegram (injection voorkomen)', 'Feedback'),
    Check('E-mailvalidatie op admin-invite en coachEmail in share-overview', 'E-mailvalidatie'),
    Check('name-parameter in 1on1 afgekapt op 100 tekens', 'name-parameter'),

    Sub('Middleware Hardening'),
    Check('Scanner-blokkering: .env, .git, wp-admin, phpMyAdmin, xmlrpc.php etc. → 404', 'Scanner-blokkering:'),
    Check('Admin route beschermd via isAdminRoute matcher in middleware', 'Admin route'),

    Sub('Foutafhandeling (geen info-lek)'),
    Check('6 routes gecorrigeerd: interne foutmeldingen niet meer teruggegeven aan client', '6 routes'),
    Check('Supabase/Resend/Anthropic fouten worden alleen server-side gelogd', 'Supabase/Resend/Anthropic'),

    Sub('Timeouts'),
    Check('maxDuration ingesteld op 12 AI-routes (15 t/m 60 seconden)', 'maxDuration'),

    Sub('Afhankelijkheden'),
    Check('npm audit: 39 kwetsbaarheden → 13 (alle resterende zijn build-time CLI-tools)', 'npm audit:'),
    Check('Sanity CMS bijgewerkt van v3 naar v6 (actueel)', 'Sanity CMS'),
    Check('Next.js, Clerk, jspdf en ws bijgewerkt (runtime-kwetsbaarheden verholpen)', 'Next.js, Clerk,'),

    el(View, { style: s.footer },
      el(Text, { style: s.footerText }, 'ArnoBot — Security Launch Checklist'),
      el(Text, { style: s.footerText }, `versie ${DATE} — pagina 1`)
    )
  ),

  el(Page, { size: 'A4', style: s.page },

    // ── SECTIE 3: HANDMATIG ──────────────────────────
    SectionHead('📋', 'Pre-launch acties (handmatig)'),

    Sub('Vercel Dashboard'),
    Todo('Vercel Firewall aanzetten: Project Settings → Security → Enable Firewall', 'Vercel Firewall'),
    Todo('Bot Filter aanzetten in Vercel Security', 'Bot Filter'),
    Todo('Rate limiting instellen in Vercel Firewall UI (aanvullend op code-level)', 'Rate limiting'),
    Todo('NEXT_PUBLIC_APP_URL=https://arno.bot controleren in Vercel env vars', 'NEXT_PUBLIC_APP_URL'),

    Sub('Supabase'),
    Todo('RLS policies audit: run SELECT * FROM pg_policies; in Supabase SQL editor', 'RLS policies audit:'),
    Todo('Controleer dat anon rol GEEN insert/update/delete heeft op gevoelige tabellen', 'Controleer dat anon rol'),
    Todo('Database backups aanzetten (Supabase Pro of Point-in-Time Recovery)', 'Database backups'),
    Todo('Controleer dat SUPABASE_SERVICE_ROLE_KEY nergens in client-side code lekt', 'Controleer dat SUPABASE_SERVICE_ROLE_KEY'),

    Sub('Clerk'),
    Todo('Productie Clerk applicatie in gebruik (niet development instance)', 'Productie Clerk applicatie'),
    Todo('Webhook endpoint gevalideerd met CLERK_WEBHOOK_SECRET', 'Webhook endpoint'),
    Todo('Session duration instellen: Settings → Sessions → Token lifetime', 'Session duration'),

    Sub('Git / Code'),
    Todo('.gitignore bevat: .env, .env.local, .env.*.local', '.gitignore bevat:'),
    Todo('Run: git log --all --full-history -- "**/.env*"  — check geen secrets gecommit', 'Run:'),
    Todo('Run: grep -r "sk-ant-" . --include="*.ts" --include="*.tsx"  — geen hardcoded keys'),
    Todo('Run: grep -r "service_role" . --include="*.ts" --include="*.tsx"  — alleen server routes'),

    Sub('Admin sleutel'),
    Todo('ARNOBOT_ADMIN_KEY roteren naar sterke willekeurige string (post-launch)', 'ARNOBOT_ADMIN_KEY'),
    Todo('Genereer nieuwe waarde: openssl rand -hex 32', 'Genereer nieuwe waarde:'),
    Todo('Bijwerken in Vercel env vars', 'Bijwerken in Vercel'),

    HR(),

    // ── SECTIE 4: HEADER TEST ──────────────────────────
    SectionHead('🔍', 'Security headers testen'),

    el(Text, { style: { fontSize: 9.5, color: '#374151', marginBottom: 6 } },
      'Na deployment, test op securityheaders.com en observatory.mozilla.org. Target: grade A of A+.'
    ),
    el(Text, { style: { fontSize: 9.5, color: '#374151', marginBottom: 8 } },
      'Verwachte headers:'
    ),

    el(View, { style: s.termBlock },
      el(View, { style: s.termRow }, el(Text, { style: s.termCheck }, '✓'), el(Text, { style: s.termText }, '  X-Frame-Options: DENY')),
      el(View, { style: s.termRow }, el(Text, { style: s.termCheck }, '✓'), el(Text, { style: s.termText }, '  X-Content-Type-Options: nosniff')),
      el(View, { style: s.termRow }, el(Text, { style: s.termCheck }, '✓'), el(Text, { style: s.termText }, '  Strict-Transport-Security: max-age=31536000; includeSubDomains')),
      el(View, { style: s.termRow }, el(Text, { style: s.termCheck }, '✓'), el(Text, { style: s.termText }, '  Content-Security-Policy: aanwezig')),
      el(View, { style: s.termRow }, el(Text, { style: s.termCheck }, '✓'), el(Text, { style: s.termText }, '  Referrer-Policy: strict-origin-when-cross-origin')),
      el(View, { style: s.termRow }, el(Text, { style: s.termCheck }, '✓'), el(Text, { style: s.termText }, '  Permissions-Policy: aanwezig')),
      el(View, { style: s.termRow }, el(Text, { style: s.termCross }, '✗'), el(Text, { style: s.termText }, '  X-Powered-By: afwezig (goed!)')),
    ),

    HR(),

    // ── SECTIE 5: DDOS TABEL ──────────────────────────
    SectionHead('🚨', "DDoS scenario's — wat beschermt wat?"),

    el(View, { style: s.table },
      TableRow('Aanval type', 'Bescherming', true),
      TableRow('Volumetrisch (flood)', 'Vercel Edge Network (automatisch)'),
      TableRow('API hammering (chat)', 'Rate limiting: 5 req/min per IP'),
      TableRow('Slow Loris', 'Vercel timeout + maxDuration op alle AI-routes'),
      TableRow('SQL-injectie', 'Supabase parameterized queries + Row Level Security'),
      TableRow('XSS', 'CSP headers + input sanitatie'),
      TableRow('Prompt injection', 'detectPromptInjection() in hoofdchat (14 patronen)'),
      TableRow('Admin brute force', 'Rate limit + 500ms vertraging + httpOnly cookie'),
      TableRow('Scanner bots', 'Middleware bot detection + 404 response'),
      TableRow('.env / git scan', 'Middleware blocked paths + Vercel redirects'),
      TableRow('IDOR', 'userId altijd uit sessie, nooit uit request params'),
      TableRow('Credential stuffing', 'LinkedIn OAuth via Clerk (geen wachtwoord mogelijk)'),
    ),

    HR(),

    // ── SECTIE 6: NA OPRICHTING ──────────────────────
    SectionHead('📅', 'Na bedrijfsoprichting'),

    Todo('Supabase DPA tekenen', 'Supabase DPA'),
    Todo('Clerk DPA URL opslaan', 'Clerk DPA'),
    Todo('Vercel DPA URL opslaan', 'Vercel DPA'),
    Todo('Anthropic DPA URL opslaan', 'Anthropic DPA'),
    Todo('ArnoBot DPA invullen (KvK + vestigingsadres)', 'ArnoBot DPA'),
    Todo('Privacypagina artikel 1 updaten met KvK-nummer', 'Privacypagina'),
    Todo('Anthropic cost alerts instellen in Anthropic console', 'Anthropic cost alerts'),

    HR(),

    el(Text, { style: s.footerText }, `Laatste update: ${DATE}  —  ArnoBot security review`),

    el(View, { style: s.footer },
      el(Text, { style: s.footerText }, 'ArnoBot — Security Launch Checklist'),
      el(Text, { style: s.footerText }, `versie ${DATE} — pagina 2`)
    )
  )
)

const buffer = await renderToBuffer(doc)
const outPath = join(__dirname, '..', 'public', 'arnobot-beveiliging.pdf')
writeFileSync(outPath, buffer)
console.log('PDF gegenereerd:', outPath, `(${buffer.length} bytes)`)
