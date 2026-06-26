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

const MARGIN = 52
const FOOTER_SPACE = 48 // ruimte voor footer onderaan

const s = StyleSheet.create({
  page: { backgroundColor: white, fontFamily: 'Helvetica', color: mid },

  coverStripe: {
    backgroundColor: dark,
    paddingTop: 56, paddingBottom: 44,
    paddingLeft: MARGIN, paddingRight: MARGIN,
  },
  coverLabel: { fontSize: 8, letterSpacing: 3, color: amber, marginBottom: 10 },
  coverTitle: { fontSize: 28, fontFamily: 'Helvetica-Bold', color: white, lineHeight: 1.25, marginBottom: 14 },
  coverSub:   { fontSize: 10.5, color: light, lineHeight: 1.7 },
  coverMeta:  { marginTop: 28, fontSize: 8.5, color: muted },

  bodyP1: { paddingLeft: MARGIN, paddingRight: MARGIN, paddingBottom: FOOTER_SPACE, paddingTop: 36 },
  bodyP2: { paddingLeft: MARGIN, paddingRight: MARGIN, paddingBottom: FOOTER_SPACE, paddingTop: 52 },
  bodyP3: { paddingLeft: MARGIN, paddingRight: MARGIN, paddingBottom: FOOTER_SPACE, paddingTop: 52 },

  intro: { paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: line, marginBottom: 28 },
  introText: { fontSize: 10.5, lineHeight: 1.8, color: mid },

  // Secties — wrap:false zodat ze nooit doormidden knippen
  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 7.5, letterSpacing: 3, color: amber, marginBottom: 5 },
  sectionTitle: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: dark, marginBottom: 10 },
  body1: { fontSize: 10, lineHeight: 1.75, color: mid, marginBottom: 8 },

  item: { flexDirection: 'row', marginBottom: 7, alignItems: 'flex-start' },
  itemDot: { width: 14, fontSize: 10, color: amber, marginTop: 1 },
  itemText: { flex: 1, fontSize: 10, lineHeight: 1.65, color: mid },
  itemBold: { fontFamily: 'Helvetica-Bold', color: dark },

  divider: { borderBottomWidth: 1, borderBottomColor: line, marginBottom: 24, marginTop: 4 },

  box: {
    backgroundColor: '#f9fafb',
    borderLeftWidth: 3, borderLeftColor: amber,
    paddingTop: 10, paddingBottom: 10,
    paddingLeft: 14, paddingRight: 14,
    marginBottom: 12, marginTop: 4,
  },
  boxBold: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: dark, marginBottom: 3 },
  boxText: { fontSize: 9.5, lineHeight: 1.65, color: mid },

  tHead: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: dark, paddingBottom: 5 },
  tRow:  { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: line, paddingTop: 6, paddingBottom: 6 },
  tC1h:  { width: '34%', fontSize: 9, fontFamily: 'Helvetica-Bold', color: dark },
  tC2h:  { width: '66%', fontSize: 9, fontFamily: 'Helvetica-Bold', color: dark },
  tC1:   { width: '34%', fontSize: 9, color: dark, fontFamily: 'Helvetica-Bold', paddingRight: 8 },
  tC2:   { width: '66%', fontSize: 9, color: mid, lineHeight: 1.5 },

  footer: {
    position: 'absolute',
    bottom: 24, left: MARGIN, right: MARGIN,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: line, paddingTop: 7,
  },
  footerText: { fontSize: 7.5, color: muted },
})

const DATE = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
function el(t, p, ...c) { return React.createElement(t, p, ...c) }

// Sectie die nooit doormidden knipt
function Sec(label, title, ...children) {
  return el(View, { style: s.section, wrap: false },
    el(Text, { style: s.sectionLabel }, label),
    el(Text, { style: s.sectionTitle }, title),
    ...children
  )
}

function Item(bold, desc) {
  return el(View, { style: s.item },
    el(Text, { style: s.itemDot }, '·'),
    el(Text, { style: s.itemText },
      el(Text, { style: s.itemBold }, bold + '  '),
      desc
    )
  )
}

function HR() { return el(View, { style: s.divider }) }

function THead(c1, c2) {
  return el(View, { style: s.tHead, wrap: false },
    el(Text, { style: s.tC1h }, c1),
    el(Text, { style: s.tC2h }, c2),
  )
}
function TRow(c1, c2) {
  return el(View, { style: s.tRow },
    el(Text, { style: s.tC1 }, c1),
    el(Text, { style: s.tC2 }, c2),
  )
}

function Footer(n) {
  return el(View, { style: s.footer },
    el(Text, { style: s.footerText }, 'ArnoBot — Hoe wij jouw gegevens beschermen'),
    el(Text, { style: s.footerText }, `${DATE}  ·  pagina ${n} van 3`)
  )
}

const doc = el(Document, { title: 'ArnoBot — Hoe wij jouw gegevens beschermen', author: 'ArnoBot' },

  // ── PAGINA 1: cover + intro + infrastructuur ──────────
  el(Page, { size: 'A4', style: s.page },

    el(View, { style: s.coverStripe },
      el(Text, { style: s.coverLabel }, 'ARNOBOT'),
      el(Text, { style: s.coverTitle }, 'Hoe wij jouw\ngegevens beschermen'),
      el(Text, { style: s.coverSub },
        'Een overzicht van de technische maatregelen die ArnoBot heeft getroffen\nom jouw privacy en de veiligheid van jouw data te waarborgen.'
      ),
      el(Text, { style: s.coverMeta }, `Versie 1.0  ·  ${DATE}  ·  privacy@arno.bot`)
    ),

    el(View, { style: s.bodyP1 },

      el(View, { style: s.intro, wrap: false },
        el(Text, { style: s.introText },
          'Vertrouwen is de basis van alles wat ArnoBot doet. Jij deelt persoonlijke inzichten, zakelijke uitdagingen en coachingsgesprekken met ons platform. Het is onze verantwoordelijkheid om die informatie te behandelen met de grootst mogelijke zorg. Dit document legt uit hoe wij dat technisch hebben ingericht.'
        )
      ),

      Sec('WAAR JOUW GEGEVENS STAAN', 'Infrastructuur en hosting',
        el(Text, { style: s.body1 }, 'ArnoBot maakt gebruik van gevestigde, gecertificeerde partijen voor alle infrastructurele onderdelen. Wij beheren zelf geen servers.'),
        THead('Onderdeel', 'Partij en garantie'),
        TRow('Hosting', 'Vercel — serverless, wereldwijd CDN, HTTPS verplicht op alle verbindingen'),
        TRow('Database', 'Supabase — PostgreSQL in de EU, versleuteld in rust (AES-256) en tijdens transport (TLS 1.2+)'),
        TRow('Authenticatie', 'Clerk — SOC 2 Type II gecertificeerd, LinkedIn OAuth'),
        TRow('AI-verwerking', 'Anthropic — jouw berichten worden verwerkt om een antwoord te genereren en daarna niet permanent opgeslagen'),
        TRow('E-mail', 'Resend — transactionele e-mail via DKIM-geverifieerd domein'),
      ),

      HR(),

      Sec('WIE ER BIJ KAN', 'Authenticatie en toegangsbeheer',
        el(Text, { style: s.body1 }, 'Toegang tot jouw data is strikt beperkt tot jou. Wij hebben het volgende ingericht:'),
        Item('Inloggen via LinkedIn OAuth', 'Wij slaan nooit een wachtwoord op. Authenticatie verloopt via Clerk met kortlevende JWT-tokens.'),
        Item('Sessiecontrole op elke route', 'Elke API-aanroep verifieert eerst de actieve sessie. Routes zonder geldig token geven een 401-fout en stoppen direct.'),
        Item('Databasetoegang afgeschermd', 'De sleutel met volledige databaserechten is uitsluitend beschikbaar op de server en nooit zichtbaar in de browser.'),
        Item('Strikt gescheiden admintoegang', 'Beheerdersfuncties zijn beveiligd met een aparte sleutel die niet via de normale inlogflow bereikbaar is.'),
      ),
    ),

    Footer('1')
  ),

  // ── PAGINA 2: gegevensisolatie + aanvallen + invoer ──────────
  el(Page, { size: 'A4', style: s.page },
    el(View, { style: s.bodyP2 },

      Sec('JOUW DATA IS VAN JOU', 'Gegevensisolatie',
        el(Text, { style: s.body1 },
          'Een veelvoorkomende kwetsbaarheid is dat een gebruiker toegang kan krijgen tot andermans data door een parameter in de URL aan te passen. Dit heet IDOR (Insecure Direct Object Reference). ArnoBot beschermt hier actief tegen.'
        ),
        el(View, { style: s.box },
          el(Text, { style: s.boxText },
            'Elke API-route haalt jouw identiteit op uit de geverifieerde sessie. Een gebruikers-ID in een URL of requestbody wordt nooit vertrouwd. Alleen de actieve sessie bepaalt welke data wordt teruggegeven.'
          )
        ),
        Item('Exportfunctie', 'Het downloaden van jouw gegevens werkt op basis van jouw ingelogde sessie, nooit op basis van een ID in de URL.'),
        Item('Teamdata', 'Een manager ziet uitsluitend data van leden die aantoonbaar tot hetzelfde team behoren.'),
      ),

      HR(),

      Sec('AANVALLEN VOORKOMEN', 'Wat er op ons afkomt en hoe wij het stoppen',
        el(Text, { style: s.body1 }, 'Onderstaand overzicht laat zien welke aanvalstypen wij tegenkomen en welke maatregel precies wat afdekt.'),
        THead('Aanval', 'Hoe ArnoBot dit afdekt'),
        TRow('Volumetrische aanvallen', 'Vercel Edge Network absorbeert grote hoeveelheden verkeer automatisch op netwerkniveau'),
        TRow('API-misbruik', 'Maximaal 5 chatverzoeken per IP per minuut; admin-login geblokkeerd na 10 mislukte pogingen per 15 minuten'),
        TRow('Prompt injection', '14 detectiepatronen onderscheppen pogingen om het AI-model te manipuleren of data te ontfutselen'),
        TRow('Bots en scanners', 'Middleware blokkeert automatisch bekende scannerpaden: .env, .git, wp-admin, phpMyAdmin en vergelijkbare paden'),
        TRow('SQL-injectie', 'Supabase gebruikt geparametriseerde queries; Row Level Security begrenst bovendien wat elke gebruiker mag opvragen'),
        TRow('Cross-site scripting', 'Content-Security-Policy headers beperken welke scripts de browser mag uitvoeren'),
        TRow('Credential stuffing', 'Inloggen zonder wachtwoord via LinkedIn OAuth. Er valt niets te raden of te stelen.'),
        TRow('Informatielekken', 'Technische foutdetails worden nooit aan de gebruiker getoond, alleen server-side gelogd'),
        TRow('IDOR', 'Gebruikers-ID altijd uit de geverifieerde sessie, nooit uit URL of requestbody'),
      ),

      HR(),

      Sec('INVOERBEVEILIGING', 'Wat er met jouw tekst gebeurt',
        Item('Lengtelimieten', 'Chatberichten max 4.000 tekens, oefengesprekken max 2.000 tekens, vrije invoervelden max 500 tekens.'),
        Item('Sanitatie', 'Tekst die wordt doorgestuurd naar externe diensten wordt eerst ontdaan van tekens die tot injectie kunnen leiden.'),
        Item('E-mailvalidatie', 'E-mailadressen worden gecontroleerd op geldigheid voordat ze worden verwerkt of opgeslagen.'),
      ),
    ),

    Footer('2')
  ),

  // ── PAGINA 3: headers + software + rechten + contact ──────────
  el(Page, { size: 'A4', style: s.page },
    el(View, { style: s.bodyP3 },

      Sec('BEVEILIGING IN DE BROWSER', 'HTTP-beveiligingsheaders',
        el(Text, { style: s.body1 }, 'Elke pagina van ArnoBot wordt geserveerd met beveiligingsheaders die de browser instrueert hoe hij de inhoud moet behandelen.'),
        Item('X-Frame-Options: DENY', 'Voorkomt dat ArnoBot in een verborgen iframe op een andere site kan worden geladen (clickjacking).'),
        Item('X-Content-Type-Options: nosniff', 'Voorkomt dat de browser bestanden als een ander type interpreteert dan bedoeld.'),
        Item('Strict-Transport-Security', 'Dwingt de browser om altijd HTTPS te gebruiken, ook als je per ongeluk http:// typt.'),
        Item('Content-Security-Policy', 'Beperkt welke externe bronnen de browser mag laden.'),
        Item('Referrer-Policy', 'Beperkt welke URL-informatie wordt meegestuurd bij externe links.'),
        Item('Permissions-Policy', 'Schakelt browserfeatures uit die ArnoBot niet gebruikt: camera, microfoon en locatietoegang.'),
        Item('X-Powered-By verborgen', 'De technologie achter ArnoBot wordt niet bekendgemaakt aan derden.'),
      ),

      HR(),

      Sec('SOFTWAREKWALITEIT', 'Afhankelijkheden en updates',
        el(Text, { style: s.body1 }, 'Moderne webapplicaties zijn opgebouwd uit externe softwarepakketten. Kwetsbaarheden daarin kunnen ook jouw data raken. ArnoBot houdt dit actief bij.'),
        Item('Regelmatige audit', 'Alle pakketten worden gecontroleerd op bekende kwetsbaarheden. Kwetsbaarheden in runtime-code worden direct verholpen.'),
        Item('Nul bekende runtime-kwetsbaarheden', 'Na de laatste securitysessie zijn alle kwetsbaarheden in code die in productie draait verholpen.'),
        Item('Tijdslimiet op AI-aanroepen', 'Alle verbindingen met het AI-model hebben een maximale looptijd om ongecontroleerd resourcegebruik te voorkomen.'),
        Item('Automatische monitoring', 'Dependabot controleert wekelijks alle pakketten op nieuwe kwetsbaarheden en meldt dit direct.'),
      ),

      HR(),

      Sec('JOUW RECHTEN', 'Inzage, export en verwijdering',
        el(Text, { style: s.body1 }, 'Op grond van de AVG heb je de volgende rechten, direct uitoefenbaar vanuit jouw account:'),
        Item('Recht op inzage (art. 15)', 'Download al jouw opgeslagen gegevens via Accountinstellingen → Jouw data.'),
        Item('Recht op verwijdering (art. 17)', 'Verzoek tot verwijdering via Accountinstellingen → Account verwijderen. Handmatig verwerkt binnen de wettelijke termijn.'),
        Item('Recht op rectificatie (art. 16)', 'Pas je profiel aan via de profielpagina.'),
        Item('Datalekken', 'In geval van een datalek word je binnen 72 uur geïnformeerd via het e-mailadres dat aan jouw account is gekoppeld.'),
      ),

      HR(),

      Sec('CONTACT', 'Vragen over jouw data',
        el(Text, { style: s.body1 }, 'Heb je vragen over hoe ArnoBot met jouw gegevens omgaat, of wil je een van jouw AVG-rechten uitoefenen?'),
        el(View, { style: s.box },
          el(Text, { style: s.boxBold }, 'privacy@arno.bot'),
          el(Text, { style: s.boxText }, 'Verzoeken worden binnen 10 werkdagen beantwoord.'),
        ),
      ),
    ),

    Footer('3')
  )
)

const buffer = await renderToBuffer(doc)
const outPath = join(__dirname, '..', 'public', 'arnobot-beveiliging.pdf')
writeFileSync(outPath, buffer)
console.log('PDF gegenereerd:', outPath, `(${buffer.length} bytes)`)
