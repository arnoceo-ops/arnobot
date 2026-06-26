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

const s = StyleSheet.create({
  page: { backgroundColor: white, fontFamily: 'Helvetica', color: mid },

  // Cover stripe
  coverStripe: { backgroundColor: dark, paddingTop: 60, paddingBottom: 48, paddingLeft: 52, paddingRight: 52 },
  coverLabel:  { fontSize: 8, letterSpacing: 3, color: amber, marginBottom: 10, fontFamily: 'Helvetica' },
  coverTitle:  { fontSize: 30, fontFamily: 'Helvetica-Bold', color: white, lineHeight: 1.2, marginBottom: 12 },
  coverSub:    { fontSize: 11, color: light, lineHeight: 1.6 },
  coverMeta:   { marginTop: 32, fontSize: 8.5, color: muted },

  // Body
  body: { paddingLeft: 52, paddingRight: 52, paddingBottom: 60 },

  // Intro
  intro: { paddingTop: 36, paddingBottom: 28, borderBottomWidth: 1, borderBottomColor: line, marginBottom: 32 },
  introText: { fontSize: 11, lineHeight: 1.75, color: mid },

  // Section
  section: { marginBottom: 30 },
  sectionLabel: { fontSize: 7.5, letterSpacing: 3, color: amber, fontFamily: 'Helvetica', marginBottom: 6 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: dark, marginBottom: 12 },
  body1: { fontSize: 10, lineHeight: 1.75, color: mid, marginBottom: 8 },

  // Item list
  item: { flexDirection: 'row', marginBottom: 7, alignItems: 'flex-start' },
  itemDot: { width: 16, fontSize: 10, color: amber, marginTop: 1 },
  itemText: { flex: 1, fontSize: 10, lineHeight: 1.65, color: mid },
  itemBold: { fontFamily: 'Helvetica-Bold', color: dark },

  divider: { borderBottomWidth: 1, borderBottomColor: line, marginBottom: 30 },

  // Highlight box
  box: { backgroundColor: '#f9fafb', borderLeftWidth: 3, borderLeftColor: amber, padding: '10 14', marginBottom: 20 },
  boxText: { fontSize: 9.5, lineHeight: 1.65, color: mid },

  // Two-column table
  table: { marginBottom: 8 },
  tRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: line, paddingVertical: 7 },
  tHead: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: dark, paddingBottom: 6, marginBottom: 2 },
  tC1: { width: '38%', fontSize: 9.5, color: dark, fontFamily: 'Helvetica-Bold' },
  tC2: { width: '62%', fontSize: 9.5, color: mid, lineHeight: 1.5 },
  tC1b: { width: '38%', fontSize: 9.5, color: dark },

  // Footer
  footer: { position: 'absolute', bottom: 28, left: 52, right: 52, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: line, paddingTop: 8 },
  footerL: { fontSize: 7.5, color: muted },
  footerR: { fontSize: 7.5, color: muted },
})

const DATE = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })

function el(t, p, ...c) { return React.createElement(t, p, ...c) }

function Item(label, desc) {
  return el(View, { style: s.item },
    el(Text, { style: s.itemDot }, '·'),
    el(Text, { style: s.itemText },
      el(Text, { style: s.itemBold }, label + (desc ? '  ' : '')),
      desc || ''
    )
  )
}

function Section(label, title, children) {
  return el(View, { style: s.section },
    el(Text, { style: s.sectionLabel }, label),
    el(Text, { style: s.sectionTitle }, title),
    ...children
  )
}

function Divider() { return el(View, { style: s.divider }) }

function TRow(c1, c2, head) {
  return el(View, { style: head ? s.tHead : s.tRow },
    el(Text, { style: head ? s.tC1 : s.tC1b }, c1),
    el(Text, { style: s.tC2 }, c2),
  )
}

function Footer(page) {
  return el(View, { style: s.footer },
    el(Text, { style: s.footerL }, 'ArnoBot — Hoe wij jouw gegevens beschermen'),
    el(Text, { style: s.footerR }, `${DATE}  ·  pagina ${page}`)
  )
}

const doc = el(Document, { title: 'ArnoBot — Hoe wij jouw gegevens beschermen', author: 'ArnoBot' },

  // ── PAGINA 1 ──────────────────────────────────────
  el(Page, { size: 'A4', style: s.page },

    el(View, { style: s.coverStripe },
      el(Text, { style: s.coverLabel }, 'ARNOBOT'),
      el(Text, { style: s.coverTitle }, 'Hoe wij jouw\ngegevens beschermen'),
      el(Text, { style: s.coverSub },
        'Een overzicht van de technische maatregelen die ArnoBot heeft getroffen\nom jouw privacy en de veiligheid van jouw data te waarborgen.'
      ),
      el(Text, { style: s.coverMeta }, `Versie 1.0  ·  ${DATE}  ·  privacy@arno.bot`)
    ),

    el(View, { style: s.body },

      el(View, { style: s.intro },
        el(Text, { style: s.introText },
          'Vertrouwen is de basis van alles wat ArnoBot doet. Jij deelt persoonlijke inzichten, zakelijke uitdagingen en coachingsgesprekken met ons platform. Het is onze verantwoordelijkheid om die informatie te behandelen met de grootst mogelijke zorg. Dit document legt uit hoe wij dat technisch hebben ingericht.'
        )
      ),

      Section('WAAR JOUW GEGEVENS STAAN', 'Infrastructuur en hosting', [
        el(Text, { style: s.body1 },
          'ArnoBot maakt gebruik van gevestigde, gecertificeerde partijen voor alle infrastructurele onderdelen. Wij beheren zelf geen servers.'
        ),
        el(View, { style: s.table },
          TRow('Onderdeel', 'Partij en garantie', true),
          TRow('Hosting', 'Vercel — serverless, wereldwijd CDN, HTTPS verplicht op alle verbindingen'),
          TRow('Database', 'Supabase — PostgreSQL in de EU, versleuteld in rust (AES-256) en tijdens transport (TLS 1.2+)'),
          TRow('Authenticatie', 'Clerk — SOC 2 Type II gecertificeerd, LinkedIn OAuth'),
          TRow('AI-verwerking', 'Anthropic — jouw berichten worden verwerkt om een antwoord te genereren en daarna niet permanent opgeslagen'),
          TRow('E-mail', 'Resend — transactionele e-mail via DKIM-geverifieerd domein'),
        ),
      ]),

      Divider(),

      Section('WIE ER BIJ KAN', 'Authenticatie en toegangsbeheer', [
        el(Text, { style: s.body1 },
          'Toegang tot jouw data is strikt beperkt tot jou. Wij hebben het volgende ingericht:'
        ),
        Item('Inloggen via LinkedIn OAuth', 'Wij slaan nooit een wachtwoord op. Authenticatie verloopt via Clerk, dat jouw sessie beheert met kortlevende JWT-tokens.'),
        Item('Sessiecontrole op elke route', 'Elke API-aanroep verifieert eerst de actieve sessie. Routes die geen geldig token terugkrijgen, geven een 401-fout en stoppen direct.'),
        Item('Databasetoegang per gebruiker', 'De databasesleutel met volledige schrijfrechten (service role key) is uitsluitend beschikbaar op de server en nooit zichtbaar in de browser.'),
        Item('Strikt gescheiden admintoegang', 'Beheerdersfuncties zijn beveiligd met een aparte sleutel die niet via de normale inlogflow bereikbaar is.'),
      ]),

    ),

    Footer('1')
  ),

  // ── PAGINA 2 ──────────────────────────────────────
  el(Page, { size: 'A4', style: s.page },
    el(View, { style: { ...s.body, paddingTop: 48 } },

      Section('JOUW DATA IS VAN JOU', 'Gegevensisolatie', [
        el(Text, { style: s.body1 },
          'Een veelvoorkomende kwetsbaarheid in webapplicaties is dat een gebruiker toegang kan krijgen tot andermans data door een parameter in de URL aan te passen — dit heet IDOR (Insecure Direct Object Reference). ArnoBot beschermt hier actief tegen.'
        ),
        el(View, { style: s.box },
          el(Text, { style: s.boxText },
            'Elke API-route haalt jouw identiteit op uit de geverifieerde sessie. Een userId in een URL of requestbody wordt nooit vertrouwd — alleen de sessie bepaalt welke data wordt teruggegeven.'
          )
        ),
        Item('Exportfunctie', 'Het downloaden van jouw gegevens werkt op basis van jouw ingelogde sessie, nooit op basis van een ID in de URL.'),
        Item('Teamdata', 'Een manager ziet uitsluitend data van leden die aantoonbaar tot hetzelfde team behoren.'),
      ]),

      Divider(),

      Section('AANVALLEN VOORKOMEN', 'Wat er op ons afkomt en hoe wij het stoppen', [
        el(Text, { style: s.body1 },
          'Onderstaand overzicht laat zien welke aanvalstypen wij tegenkomen en welke maatregel precies wat afdekt.'
        ),
        el(View, { style: s.table },
          TRow('Aanval', 'Hoe ArnoBot dit afdekt', true),
          TRow('Volumetrische aanvallen (DDoS)', 'Vercel Edge Network absorbeert grote hoeveelheden verkeer automatisch op netwerkniveau'),
          TRow('API-misbruik (hammering)', 'Maximaal 5 chatverzoeken per IP per minuut; admin-login geblokkeerd na 10 mislukte pogingen per 15 minuten'),
          TRow('Prompt injection', '14 detectiepatronen (Nederlands en Engels) onderscheppen pogingen om het AI-model te manipuleren of gevoelige data te ontfutselen'),
          TRow('Bots en vulnerability scanners', 'Middleware blokkeert automatisch bekende scannerpaden zoals .env, .git, wp-admin en phpMyAdmin'),
          TRow('SQL-injectie', 'Supabase gebruikt geparametriseerde queries; bovendien begrenst Row Level Security wat elke gebruiker mag opvragen'),
          TRow('Cross-site scripting (XSS)', 'Content-Security-Policy headers beperken welke scripts de browser mag uitvoeren'),
          TRow('Credential stuffing', 'Inloggen zonder wachtwoord via LinkedIn OAuth. Er valt niets te raden of te stelen.'),
          TRow('Informatielekken via foutmeldingen', 'Technische foutdetails (databasefouten, stack traces) worden nooit aan de gebruiker getoond, alleen server-side gelogd'),
        ),
      ]),

      Divider(),

      Section('INVOERBEVEILIGING', 'Wat er met jouw tekst gebeurt', [
        Item('Lengtelimieten', 'Alle tekstvelden hebben een maximum: chatberichten max 4.000 tekens, oefengesprekken max 2.000 tekens, vrije invoervelden max 500 tekens. Dit voorkomt misbruik van rekenkracht.'),
        Item('Sanitatie', 'Tekst die wordt doorgestuurd naar externe diensten wordt eerst ontdaan van tekens die tot injectie kunnen leiden.'),
        Item('E-mailvalidatie', 'E-mailadressen worden gecontroleerd op geldigheid voordat ze worden verwerkt of opgeslagen.'),
      ]),

    ),

    Footer('2')
  ),

  // ── PAGINA 3 ──────────────────────────────────────
  el(Page, { size: 'A4', style: s.page },
    el(View, { style: { ...s.body, paddingTop: 48 } },

      Section('BEVEILIGING IN DE BROWSER', 'HTTP-beveiligingsheaders', [
        el(Text, { style: s.body1 },
          'Elke pagina van ArnoBot wordt geserveerd met een set beveiligingsheaders die de browser instrueert hoe hij de inhoud moet behandelen. Dit beschermt jou ook als er iets misgaat aan de browserkant.'
        ),
        Item('X-Frame-Options: DENY', 'Voorkomt dat de ArnoBot-interface in een verborgen iframe op een andere site kan worden geladen (clickjacking).'),
        Item('X-Content-Type-Options: nosniff', 'Voorkomt dat de browser bestanden als een ander type interpreteert dan bedoeld.'),
        Item('Strict-Transport-Security (HSTS)', 'Dwingt de browser om altijd HTTPS te gebruiken, ook als je per ongeluk http:// typt.'),
        Item('Content-Security-Policy', 'Beperkt welke externe bronnen (scripts, lettertypen, afbeeldingen) de browser mag laden.'),
        Item('Referrer-Policy', 'Beperkt welke URL-informatie wordt meegestuurd bij externe links.'),
        Item('Permissions-Policy', 'Schakelt browserfeatures uit die ArnoBot niet gebruikt: camera, microfoon en locatietoegang.'),
        Item('X-Powered-By: verborgen', 'De technologie achter ArnoBot wordt niet aan derden bekendgemaakt.'),
      ]),

      Divider(),

      Section('SOFTWAREKWALITEIT', 'Afhankelijkheden en updates', [
        el(Text, { style: s.body1 },
          'Moderne webapplicaties zijn opgebouwd uit honderden externe softwarepakketten. Kwetsbaarheden in die pakketten kunnen ook jouw data raken. ArnoBot houdt dit actief bij.'
        ),
        Item('Regelmatige audit', 'Alle npm-pakketten worden gecontroleerd op bekende kwetsbaarheden. Kwetsbaarheden in runtime-code worden direct verholpen.'),
        Item('Nul bekende runtime-kwetsbaarheden', 'Na de laatste securitysessie zijn alle kwetsbaarheden in code die daadwerkelijk in productie draait verholpen. Resterende meldingen betreffen uitsluitend interne bouwtooling die nooit in aanraking komt met gebruikersdata.'),
        Item('Tijdslimiet op AI-aanroepen', 'Alle verbindingen met het AI-model hebben een maximale looptijd. Dit voorkomt dat een hanerige of kwaadwillende aanroep ongecontroleerd resources verbruikt.'),
      ]),

      Divider(),

      Section('JOUW RECHTEN', 'Inzage, export en verwijdering', [
        el(Text, { style: s.body1 },
          'Op grond van de Algemene Verordening Gegevensbescherming (AVG) heb je de volgende rechten, die je direct vanuit jouw account kunt uitoefenen:'
        ),
        Item('Recht op inzage (art. 15 AVG)', 'Download al jouw opgeslagen gegevens via Accountinstellingen → Jouw data.'),
        Item('Recht op verwijdering (art. 17 AVG)', 'Verzoek tot verwijdering van jouw account en alle bijbehorende data via Accountinstellingen → Account verwijderen. Verzoeken worden handmatig verwerkt binnen de wettelijke termijn.'),
        Item('Recht op rectificatie (art. 16 AVG)', 'Pas je profiel en persoonlijke gegevens aan via de profielpagina.'),
        Item('Datalekken', 'In geval van een datalek word je binnen 72 uur geïnformeerd via het e-mailadres dat aan jouw account is gekoppeld.'),
      ]),

      Divider(),

      Section('CONTACT', 'Vragen over jouw data', [
        el(Text, { style: s.body1 },
          'Heb je vragen over hoe ArnoBot met jouw gegevens omgaat, of wil je een van jouw AVG-rechten uitoefenen? Stuur een e-mail naar:'
        ),
        el(View, { style: s.box },
          el(Text, { style: { ...s.boxText, fontFamily: 'Helvetica-Bold', color: dark } }, 'privacy@arno.bot'),
          el(Text, { style: { ...s.boxText, marginTop: 4 } }, 'Verzoeken worden binnen 10 werkdagen beantwoord.')
        ),
      ]),

    ),

    Footer('3')
  )
)

const buffer = await renderToBuffer(doc)
const outPath = join(__dirname, '..', 'public', 'arnobot-beveiliging.pdf')
writeFileSync(outPath, buffer)
console.log('PDF gegenereerd:', outPath, `(${buffer.length} bytes)`)
