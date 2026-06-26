import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const s = StyleSheet.create({
  page: { backgroundColor: '#ffffff', padding: 52, fontFamily: 'Helvetica', fontSize: 10, color: '#1f2937' },

  header: { borderBottomWidth: 3, borderBottomColor: '#f59e0b', paddingBottom: 14, marginBottom: 28 },
  headerEyebrow: { fontSize: 7, letterSpacing: 3, color: '#f59e0b', marginBottom: 5 },
  headerTitle: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: '#111827' },
  headerSub: { fontSize: 9, color: '#6b7280', marginTop: 4 },

  section: { marginBottom: 22 },
  sectionTitle: { fontSize: 8, letterSpacing: 2.5, color: '#f59e0b', marginBottom: 8, fontFamily: 'Helvetica-Bold' },

  para: { fontSize: 10, lineHeight: 1.7, color: '#374151', marginBottom: 6 },

  bullet: { flexDirection: 'row', marginBottom: 5 },
  bulletDot: { width: 14, fontSize: 10, color: '#f59e0b' },
  bulletText: { flex: 1, fontSize: 10, lineHeight: 1.6, color: '#374151' },

  label: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#111827' },

  divider: { borderBottomWidth: 1, borderBottomColor: '#e5e7eb', marginVertical: 18 },

  footer: { position: 'absolute', bottom: 36, left: 52, right: 52, borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7.5, color: '#9ca3af' },
})

function Bullet({ children }: { children: string }) {
  return (
    <View style={s.bullet}>
      <Text style={s.bulletDot}>•</Text>
      <Text style={s.bulletText}>{children}</Text>
    </View>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  )
}

const DATE = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })

export function BeveiligingsPdfDocument() {
  return (
    <Document title="ArnoBot — Beveiliging & Gegevensbescherming" author="ArnoBot">
      <Page size="A4" style={s.page}>

        <View style={s.header}>
          <Text style={s.headerEyebrow}>ARNOBOT</Text>
          <Text style={s.headerTitle}>Beveiliging & Gegevensbescherming</Text>
          <Text style={s.headerSub}>Overzicht van technische en organisatorische maatregelen — versie {DATE}</Text>
        </View>

        <Section title="1. OVER DIT DOCUMENT">
          <Text style={s.para}>
            Dit document beschrijft de beveiligingsmaatregelen die ArnoBot heeft geïmplementeerd om jouw gegevens te beschermen. Het is bedoeld voor gebruikers die willen begrijpen hoe hun data wordt verwerkt, opgeslagen en beveiligd.
          </Text>
        </Section>

        <Section title="2. INFRASTRUCTUUR EN HOSTING">
          <Bullet>Hosting: Vercel (serverless, wereldwijd edge-netwerk, HTTPS verplicht)</Bullet>
          <Bullet>Database: Supabase (PostgreSQL, EU-regio, versleuteld in rust en transit via TLS 1.2+)</Bullet>
          <Bullet>Authenticatie: Clerk (SOC 2 Type II gecertificeerd, LinkedIn OAuth)</Bullet>
          <Bullet>AI-verwerking: Anthropic API (berichten worden tijdelijk verwerkt voor het genereren van een antwoord; Anthropic slaat geen gesprekken permanent op)</Bullet>
          <Bullet>E-mail: Resend (transactionele e-mail via DKIM-geverifieerd domein)</Bullet>
        </Section>

        <Section title="3. AUTHENTICATIE EN TOEGANGSBEHEER">
          <Bullet>Inloggen verloopt uitsluitend via LinkedIn OAuth via Clerk; wachtwoorden worden nooit door ArnoBot opgeslagen</Bullet>
          <Bullet>Alle beveiligde routes controleren actief de sessie-identiteit via Clerk middleware</Bullet>
          <Bullet>De Supabase service role key is uitsluitend beschikbaar in de serveromgeving en nooit blootgesteld aan de client</Bullet>
          <Bullet>Admin-toegang is beveiligd met een aparte, roteerbare sleutel (httpOnly cookie)</Bullet>
          <Bullet>Admin-inlogpogingen zijn beperkt tot 10 per IP-adres per 15 minuten, met een ingebouwde vertraging na mislukte pogingen</Bullet>
          <Bullet>Cron-jobs zijn beveiligd met een CRON_SECRET header die bij elke aanroep wordt geverifieerd</Bullet>
        </Section>

        <View style={s.divider} />

        <Section title="4. GEGEVENSISOLATIE (IDOR-BESCHERMING)">
          <Text style={s.para}>
            Insecure Direct Object Reference (IDOR) is een veelvoorkomende kwetsbaarheid waarbij een gebruiker door het aanpassen van een parameter toegang krijgt tot andermans data.
          </Text>
          <Bullet>Elke API-route haalt de gebruikers-ID op uit de geverifieerde sessie, nooit uit de URL of de request-body</Bullet>
          <Bullet>Het PDF-exportendpoint accepteert geen externe user_id parameter; de identiteit wordt altijd uit de actieve sessie gelezen</Bullet>
          <Bullet>Manager-toegang tot teamgegevens is uitsluitend toegestaan als de manager en het doelaccount aantoonbaar lid zijn van hetzelfde team</Bullet>
        </Section>

        <Section title="5. INVOERVALIDATIE EN INJECTIEBEVEILIGING">
          <Bullet>Prompt-injectiedetectie: 14 reguliere expressies detecteren pogingen om het AI-model te manipuleren (NL en EN), inclusief rolwijzigingsopdrachten, data-extractiepogingen en instructie-overrides</Bullet>
          <Bullet>Berichtlengte-limieten: gebruikersvragen max 4.000 tekens, gespreksgeschiedenis max 40 items</Bullet>
          <Bullet>Sparring-module: berichten max 2.000 tekens, context max 500 tekens, geschiedenis max 40 items</Bullet>
          <Bullet>Feedbackveld: max 2.000 tekens, gesanitized vóór doorsturen naar externe dienst</Bullet>
          <Bullet>E-mailadressen in formulieren worden gevalideerd via regex vóór verwerking</Bullet>
          <Bullet>Alle namen en vrije tekstvelden die als AI-context worden gebruikt, worden afgekapt op veilige maximumlengtes</Bullet>
        </Section>

        <View style={s.divider} />

        <Section title="6. SNELHEIDSLIMIETEN (RATE LIMITING)">
          <Bullet>Hoofdchat: max 5 verzoeken per IP-adres per minuut, gemeten via bestaande logtabellen</Bullet>
          <Bullet>Admin-login: max 10 pogingen per IP per 15 minuten</Bullet>
          <Bullet>Teamlidmaatschap: maximaal 25 leden per team om misbruik van AI-resources te voorkomen</Bullet>
        </Section>

        <Section title="7. FOUTAFHANDELING EN INFORMATIEBEVEILIGING">
          <Bullet>Interne foutmeldingen (stack traces, databasefouten, API-sleutels) worden nooit aan de gebruiker teruggegeven</Bullet>
          <Bullet>Alle API-routes retourneren generieke foutberichten aan de client; gedetailleerde informatie wordt uitsluitend server-side gelogd</Bullet>
          <Bullet>Dit voorkomt dat aanvallers door middel van foutberichten informatie over de infrastructuur kunnen achterhalen</Bullet>
        </Section>

        <View style={s.divider} />

        <Section title="8. SCANNERBEVEILIGING EN BOT-BLOKKERING">
          <Bullet>Veelgebruikte scanpaden worden actief geblokkeerd op middleware-niveau: .env, .git, .htaccess, wp-admin, phpMyAdmin, xmlrpc.php en vergelijkbare paden</Bullet>
          <Bullet>Niet-bestaande beveiligingsgevoelige paden retourneren altijd HTTP 404 zonder aanvullende informatie</Bullet>
        </Section>

        <Section title="9. BEVEILIGINGSHEADERS">
          <Text style={s.para}>Alle HTTP-responses bevatten de volgende headers:</Text>
          <Bullet>X-Content-Type-Options: nosniff (voorkomt MIME-type sniffing)</Bullet>
          <Bullet>X-Frame-Options: DENY (voorkomt clickjacking via iframes)</Bullet>
          <Bullet>Referrer-Policy: strict-origin-when-cross-origin (beperkt doorsturen van URL-informatie)</Bullet>
          <Bullet>Content-Security-Policy: beperkt welke externe bronnen de browser mag laden</Bullet>
        </Section>

        <View style={s.divider} />

        <Section title="10. AFHANKELIJKHEIDSBEHEER">
          <Bullet>Alle bekende kwetsbaarheden in npm-pakketten zijn verholpen (npm audit: van 39 naar 13 resterende meldingen, uitsluitend in build-time CLI-tools)</Bullet>
          <Bullet>Sanity CMS bijgewerkt van versie 3 naar versie 6 (actueel)</Bullet>
          <Bullet>Next.js, Clerk, jspdf en andere runtime-afhankelijkheden zijn bijgewerkt naar versies zonder bekende kwetsbaarheden</Bullet>
          <Bullet>Resterende meldingen betreffen uitsluitend ontwikkeltools die nooit in productie draaien</Bullet>
        </Section>

        <Section title="11. SERVERLESS TIMEOUTS">
          <Bullet>Alle AI-routes hebben een geconfigureerde maximale looptijd (15 tot 60 seconden afhankelijk van de complexiteit)</Bullet>
          <Bullet>Dit voorkomt ongecontroleerde API-kosten en resource-uitputting bij abnormale of kwaadwillende verzoeken</Bullet>
        </Section>

        <View style={s.divider} />

        <Section title="12. GEGEVENSEXPORT EN -VERWIJDERING (AVG)">
          <Bullet>Gebruikers kunnen hun gegevens opvragen en exporteren via de accountpagina (recht op inzage, AVG art. 15)</Bullet>
          <Bullet>Verwijderverzoeken worden ingediend via de accountpagina en handmatig verwerkt binnen de wettelijke termijn (recht op vergetelheid, AVG art. 17)</Bullet>
          <Bullet>Bij verwijdering worden gesprekslogboeken en profielgegevens verwijderd, en het Clerk-account wordt gede-activeerd</Bullet>
        </Section>

        <Section title="13. CONTACT">
          <Text style={s.para}>
            Vragen over gegevensverwerking, beveiliging of het uitoefenen van AVG-rechten kunnen worden gestuurd naar: privacy@arno.bot
          </Text>
        </Section>

        <View style={s.footer}>
          <Text style={s.footerText}>ArnoBot — Beveiliging & Gegevensbescherming</Text>
          <Text style={s.footerText}>versie {DATE}</Text>
        </View>

      </Page>
    </Document>
  )
}
