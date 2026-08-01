import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import React from 'react'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const amber = '#f59e0b'
const dark  = '#111827'
const mid   = '#374151'
const muted = '#6b7280'
const light = '#9ca3af'
const white = '#ffffff'
const line  = '#e5e7eb'
const M = 52

const s = StyleSheet.create({
  // Pagina 1: geen paddingTop want cover stripe vult de bovenkant
  page1: { backgroundColor: white, fontFamily: 'Helvetica', color: mid },
  // Pagina's 2-4: paddingTop direct op Page zodat ook overflowpagina's marge krijgen
  page: { backgroundColor: white, fontFamily: 'Helvetica', color: mid, paddingTop: M, paddingLeft: M, paddingRight: M, paddingBottom: 48 },

  coverStripe: { backgroundColor: dark, paddingTop: 56, paddingBottom: 44, paddingLeft: M, paddingRight: M },
  coverLabel:  { fontSize: 8, letterSpacing: 3, color: amber, marginBottom: 10 },
  coverTitle:  { fontSize: 28, fontFamily: 'Helvetica-Bold', color: white, lineHeight: 1.25, marginBottom: 14 },
  coverSub:    { fontSize: 10.5, color: light, lineHeight: 1.7 },
  coverMeta:   { marginTop: 28, fontSize: 8.5, color: muted },

  body1: { paddingLeft: M, paddingRight: M, paddingBottom: 48 },

  intro:     { paddingTop: 32, paddingBottom: 22, borderBottomWidth: 1, borderBottomColor: line, marginBottom: 26 },
  introText: { fontSize: 10.5, lineHeight: 1.8, color: mid },

  sec:   { marginBottom: 22 },
  label: { fontSize: 7.5, letterSpacing: 3, color: amber, marginBottom: 5 },
  h2:    { fontSize: 15, fontFamily: 'Helvetica-Bold', color: dark, marginBottom: 10 },
  p:     { fontSize: 10, lineHeight: 1.75, color: mid, marginBottom: 8 },

  row:   { flexDirection: 'row', marginBottom: 7, alignItems: 'flex-start' },
  dot:   { width: 14, fontSize: 10, color: amber, marginTop: 1 },
  rtext: { flex: 1, fontSize: 10, lineHeight: 1.65, color: mid },
  rbold: { fontFamily: 'Helvetica-Bold', color: dark },

  div: { borderBottomWidth: 1, borderBottomColor: line, marginBottom: 22, marginTop: 4 },

  box:  { backgroundColor: '#f9fafb', borderLeftWidth: 3, borderLeftColor: amber, paddingTop: 10, paddingBottom: 10, paddingLeft: 14, paddingRight: 14, marginBottom: 12, marginTop: 4 },
  boxB: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: dark, marginBottom: 3 },
  boxT: { fontSize: 9.5, lineHeight: 1.65, color: mid },

  th: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: dark, paddingBottom: 5 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: line, paddingTop: 6, paddingBottom: 6 },
  c1: { width: '34%', fontSize: 9, fontFamily: 'Helvetica-Bold', color: dark, paddingRight: 6 },
  c2: { width: '66%', fontSize: 9, color: mid, lineHeight: 1.5 },
  c1h:{ width: '34%', fontSize: 9, fontFamily: 'Helvetica-Bold', color: dark },
  c2h:{ width: '66%', fontSize: 9, fontFamily: 'Helvetica-Bold', color: dark },

  footer: { position: 'absolute', bottom: 24, left: M, right: M, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: line, paddingTop: 7 },
  ft: { fontSize: 7.5, color: muted },
})

const DATE = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
const TOTAL = '4'
function el(t, p, ...c) { return React.createElement(t, p, ...c) }

function Sec(label, title, ...kids) {
  return el(View, { style: s.sec, wrap: false },
    el(Text, { style: s.label }, label),
    el(Text, { style: s.h2 }, title),
    ...kids
  )
}
function Item(bold, desc) {
  return el(View, { style: s.row },
    el(Text, { style: s.dot }, '·'),
    el(Text, { style: s.rtext }, el(Text, { style: s.rbold }, bold + '  '), desc)
  )
}
function HR() { return el(View, { style: s.div }) }
function TH(a, b) { return el(View, { style: s.th }, el(Text, { style: s.c1h }, a), el(Text, { style: s.c2h }, b)) }
function TR(a, b) { return el(View, { style: s.tr }, el(Text, { style: s.c1 }, a), el(Text, { style: s.c2 }, b)) }
function Footer(n) {
  return el(View, { style: s.footer, fixed: true },
    el(Text, { style: s.ft }, 'ArnoBot: Hoe wij jouw gegevens beschermen'),
    el(Text, { style: s.ft }, `${DATE}  ·  pagina ${n} van ${TOTAL}`)
  )
}

const doc = el(Document, { title: 'ArnoBot: Hoe wij jouw gegevens beschermen', author: 'ArnoBot' },

  // ── PAGINA 1: cover + intro + infrastructuur ─────────────────
  el(Page, { size: 'A4', style: s.page1 },
    el(View, { style: s.coverStripe },
      el(Text, { style: s.coverLabel }, 'ARNOBOT'),
      el(Text, { style: s.coverTitle }, 'Hoe wij jouw\ngegevens beschermen'),
      el(Text, { style: s.coverSub }, 'Een overzicht van de technische maatregelen die ArnoBot heeft getroffen\nom jouw privacy en de veiligheid van jouw data te waarborgen.'),
      el(Text, { style: s.coverMeta }, `Versie 1.4  ·  ${DATE}  ·  privacy@arno.bot`)
    ),
    el(View, { style: s.body1 },
      el(View, { style: s.intro },
        el(Text, { style: s.introText }, 'Vertrouwen is de basis van alles wat ArnoBot doet. Jij deelt persoonlijke inzichten, zakelijke uitdagingen en coachingsgesprekken met ons platform. Het is onze verantwoordelijkheid om die informatie te behandelen met de grootst mogelijke zorg. Dit document legt uit hoe wij dat technisch hebben ingericht.')
      ),
      Sec('WAAR JOUW GEGEVENS STAAN', 'Infrastructuur en hosting',
        el(Text, { style: s.p }, 'ArnoBot maakt gebruik van gevestigde, gecertificeerde partijen voor alle infrastructurele onderdelen. Wij beheren zelf geen servers.'),
        TH('Onderdeel', 'Partij en garantie'),
        TR('Hosting', 'Vercel: serverless, wereldwijd CDN, HTTPS verplicht op alle verbindingen'),
        TR('Database', 'Supabase: PostgreSQL in de EU, versleuteld in rust (AES-256) en tijdens transport (TLS 1.2+)'),
        TR('Authenticatie', 'Clerk: SOC 2 Type II gecertificeerd, LinkedIn OAuth'),
        TR('AI-verwerking', 'Anthropic: jouw berichten worden verwerkt om een antwoord te genereren en daarna niet permanent opgeslagen'),
        TR('Spraakverwerking', 'OpenAI: spraakherkenning en tekst-naar-spraak, verwerkt audio van voice-invoer, geen training op jouw data'),
        TR('Spraaksynthese (ArnoBot Voice)', 'ElevenLabs: tekst-naar-spraak voor ArnoBot Voice-abonnees, verwerkt gesproken antwoorden, geen training op jouw data'),
        TR('E-mail', 'Resend: transactionele e-mail via DKIM-geverifieerd domein'),
        TR('AI-kennisbank', 'Voyage AI: embeddings en herrangschikking voor de kennisbank en sessiegeheugen'),
        TR('Foutmonitoring', 'Sentry: foutmonitoring en performance-tracing'),
        TR('Snelheidslimieten', 'Upstash: rate limiting, verwerkt IP-adressen'),
        TR('Bezoekersanalyse', 'PostHog: anonieme klik- en paginabezoek-analyse op de publieke marketingpagina\'s, EU-hosting (Frankfurt)'),
        TR('Afspraken', 'Calendly: boeken van een kennismakingsgesprek met Arno, koppelt de boeking aan je e-mailadres'),
      ),
    ),
    Footer('1')
  ),

  // ── PAGINA 2: authenticatie + gegevensisolatie ───────────────
  el(Page, { size: 'A4', style: s.page },
    Sec('WIE ER BIJ KAN', 'Authenticatie en toegangsbeheer',
      el(Text, { style: s.p }, 'Toegang tot jouw data is strikt beperkt tot jou. Wij hebben het volgende ingericht:'),
      Item('Inloggen via LinkedIn OAuth', 'Wij slaan nooit een wachtwoord op. Authenticatie verloopt via Clerk met kortlevende JWT-tokens.'),
      Item('Sessiecontrole op elke route', 'Elke API-aanroep verifieert eerst de actieve sessie. Routes zonder geldig token geven een 401-fout en stoppen direct.'),
      Item('Databasetoegang afgeschermd', 'De sleutel met volledige databaserechten is uitsluitend beschikbaar op de server en nooit zichtbaar in de browser.'),
      Item('Strikt gescheiden admintoegang', 'Beheerdersfuncties zijn beveiligd met een aparte sleutel die niet via de normale inlogflow bereikbaar is.'),
    ),
    HR(),
    Sec('JOUW DATA IS VAN JOU', 'Gegevensisolatie',
      el(Text, { style: s.p }, 'Een veelvoorkomende kwetsbaarheid is dat een gebruiker toegang krijgt tot andermans data door een parameter in de URL aan te passen. Dit heet IDOR (Insecure Direct Object Reference). ArnoBot beschermt hier actief tegen.'),
      el(View, { style: s.box },
        el(Text, { style: s.boxT }, 'Elke API-route haalt jouw identiteit op uit de geverifieerde sessie. Een gebruikers-ID in een URL of requestbody wordt nooit vertrouwd. Alleen de actieve sessie bepaalt welke data wordt teruggegeven.')
      ),
      Item('Exportfunctie', 'Het downloaden van jouw gegevens werkt op basis van jouw ingelogde sessie, nooit op basis van een ID in de URL.'),
      Item('Teamdata', 'Een manager ziet uitsluitend data van leden die aantoonbaar tot hetzelfde team behoren.'),
    ),
    HR(),
    Sec('INVOERBEVEILIGING', 'Wat er met jouw tekst gebeurt',
      Item('Lengtelimieten', 'Chatberichten max 4.000 tekens, oefengesprekken max 2.000 tekens, vrije invoervelden max 500 tekens.'),
      Item('Sanitatie', 'Tekst die wordt doorgestuurd naar externe diensten wordt eerst ontdaan van tekens die tot injectie kunnen leiden.'),
      Item('E-mailvalidatie', 'E-mailadressen worden gecontroleerd op geldigheid voordat ze worden verwerkt of opgeslagen.'),
    ),
    Footer('2')
  ),

  // ── PAGINA 3: aanvallen + beveiligingsheaders ────────────────
  el(Page, { size: 'A4', style: s.page },
    Sec('AANVALLEN VOORKOMEN', 'Wat er op ons afkomt en hoe wij het stoppen',
      el(Text, { style: s.p }, 'Onderstaand overzicht laat zien welke aanvalstypen wij tegenkomen en welke maatregel precies wat afdekt.'),
      TH('Aanval', 'Hoe ArnoBot dit afdekt'),
      TR('Volumetrische aanvallen', 'Vercel Edge Network absorbeert grote hoeveelheden verkeer automatisch op netwerkniveau'),
      TR('API-misbruik', 'Maximaal 5 chatverzoeken per IP per minuut; admin-login geblokkeerd na 10 mislukte pogingen per 15 minuten'),
      TR('Prompt injection', '14 detectiepatronen onderscheppen pogingen om het AI-model te manipuleren of data te ontfutselen'),
      TR('Bots en scanners', 'Middleware blokkeert automatisch bekende scannerpaden: .env, .git, wp-admin, phpMyAdmin en vergelijkbare paden'),
      TR('SQL-injectie', 'Supabase gebruikt geparametriseerde queries; Row Level Security begrenst bovendien wat elke gebruiker mag opvragen'),
      TR('Cross-site scripting', 'Content-Security-Policy headers beperken welke scripts de browser mag uitvoeren'),
      TR('Credential stuffing', 'Inloggen zonder wachtwoord via LinkedIn OAuth. Er valt niets te raden of te stelen.'),
      TR('Informatielekken', 'Technische foutdetails worden nooit aan de gebruiker getoond, alleen server-side gelogd'),
      TR('IDOR', 'Gebruikers-ID altijd uit de geverifieerde sessie, nooit uit URL of requestbody'),
    ),
    HR(),
    Sec('BEVEILIGING IN DE BROWSER', 'HTTP-beveiligingsheaders',
      el(Text, { style: s.p }, 'Elke pagina van ArnoBot wordt geserveerd met beveiligingsheaders die de browser instrueert hoe hij de inhoud moet behandelen.'),
      Item('X-Frame-Options: DENY', 'Voorkomt dat ArnoBot in een verborgen iframe op een andere site kan worden geladen (clickjacking).'),
      Item('X-Content-Type-Options: nosniff', 'Voorkomt dat de browser bestanden als een ander type interpreteert dan bedoeld.'),
      Item('Strict-Transport-Security', 'Dwingt de browser om altijd HTTPS te gebruiken, ook als je per ongeluk http:// typt.'),
      Item('Content-Security-Policy', 'Beperkt welke externe bronnen de browser mag laden.'),
      Item('Permissions-Policy', 'Schakelt camera, microfoon en locatietoegang uit. ArnoBot gebruikt deze features niet.'),
      Item('X-Powered-By verborgen', 'De technologie achter ArnoBot wordt niet bekendgemaakt aan derden.'),
    ),
    Footer('3')
  ),

  // ── PAGINA 4: softwarekwaliteit + rechten + contact ──────────
  el(Page, { size: 'A4', style: s.page },
    Sec('SOFTWAREKWALITEIT', 'Afhankelijkheden en updates',
      el(Text, { style: s.p }, 'Moderne webapplicaties zijn opgebouwd uit externe softwarepakketten. Kwetsbaarheden daarin kunnen ook jouw data raken. ArnoBot houdt dit actief bij.'),
      Item('Regelmatige audit', 'Alle pakketten worden gecontroleerd op bekende kwetsbaarheden. Kwetsbaarheden in runtime-code worden direct verholpen.'),
      Item('Nul bekende runtime-kwetsbaarheden', 'Na de laatste securitysessie zijn alle kwetsbaarheden in code die in productie draait verholpen.'),
      Item('Tijdslimiet op AI-aanroepen', 'Alle verbindingen met het AI-model hebben een maximale looptijd om ongecontroleerd resourcegebruik te voorkomen.'),
      Item('Automatische monitoring', 'Dependabot controleert wekelijks alle pakketten op nieuwe kwetsbaarheden en meldt dit direct.'),
    ),
    HR(),
    Sec('JOUW RECHTEN', 'Inzage, export en verwijdering',
      el(Text, { style: s.p }, 'Op grond van de AVG heb je de volgende rechten, direct uitoefenbaar vanuit jouw account:'),
      Item('Recht op inzage (art. 15)', 'Download al jouw opgeslagen gegevens via Accountinstellingen, sectie Jouw data.'),
      Item('Recht op verwijdering (art. 17)', 'Verzoek tot verwijdering via Accountinstellingen, sectie Account verwijderen. Handmatig verwerkt binnen de wettelijke termijn.'),
      Item('Recht op rectificatie (art. 16)', 'Pas je profiel aan via de profielpagina.'),
      Item('Datalekken', 'In geval van een datalek word je binnen 72 uur geïnformeerd via het e-mailadres dat aan jouw account is gekoppeld.'),
    ),
    HR(),
    Sec('CONTACT', 'Vragen over jouw data',
      el(Text, { style: s.p }, 'Heb je vragen over hoe ArnoBot met jouw gegevens omgaat, of wil je een van jouw AVG-rechten uitoefenen?'),
      el(View, { style: s.box },
        el(Text, { style: s.boxB }, 'privacy@arno.bot'),
        el(Text, { style: s.boxT }, 'Verzoeken worden binnen 10 werkdagen beantwoord.'),
      ),
    ),
    Footer('4')
  )
)

const buffer = await renderToBuffer(doc)
const outPath = join(__dirname, '..', 'public', 'arnobot-beveiliging.pdf')
writeFileSync(outPath, buffer)
console.log('PDF gegenereerd:', outPath, `(${buffer.length} bytes)`)
