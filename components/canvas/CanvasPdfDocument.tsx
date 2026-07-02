// @ts-nocheck
import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'

interface AnswerRow { question_id: string; answer: string; score?: number | null }
interface PdfProps {
  answers: AnswerRow[]
  healthScore: number
  kwaliteitsScore: number | null
  userName: string
  laatsteAnalyse: Date | null
}

const C = {
  bg: '#111827', cream: '#f1f5f9', orange: '#f59e0b', subtle: '#1e1e1e',
  white: '#ffffff', stripe: '#f5f3f0', dark: '#3d3935', mid: '#8c8480', line: '#ddd8d0',
}

const HERO = {
  1: 'https://canvas.royaldutchsales.com/canvas/pdf/strategie-pag-1.png',
  2: 'https://canvas.royaldutchsales.com/canvas/pdf/strategie-pag-2.png',
  3: 'https://canvas.royaldutchsales.com/canvas/pdf/mensen-pag-1.png',
  4: 'https://canvas.royaldutchsales.com/canvas/pdf/mensen-pag-2.png',
  5: 'https://canvas.royaldutchsales.com/canvas/pdf/uitvoering-pag-1.png',
  6: 'https://canvas.royaldutchsales.com/canvas/pdf/uitvoering-pag-2.png',
}

const s = StyleSheet.create({
  pageDark: { backgroundColor: C.bg, padding: '48 52', fontFamily: 'Helvetica', color: C.cream },
  pageLight: { backgroundColor: C.white, fontFamily: 'Helvetica', color: C.dark },
  coverLabel: { color: C.orange, fontSize: 8, letterSpacing: 3, marginBottom: 8, opacity: 0.7 },
  coverTitle: { fontSize: 68, color: C.cream, marginBottom: 6, lineHeight: 1, fontFamily: 'Helvetica-Bold' },
  coverSub: { color: C.cream, fontSize: 10, opacity: 0.35, marginBottom: 48 },
  coverDivider: { height: 1, backgroundColor: C.subtle, marginBottom: 32 },
  scoreLabel: { color: C.orange, fontSize: 7, letterSpacing: 3, marginBottom: 4 },
  scoreNumber: { fontSize: 56, color: C.cream, lineHeight: 1, marginBottom: 10, fontFamily: 'Helvetica-Bold' },
  scoreBar: { height: 2, backgroundColor: C.subtle, marginBottom: 3 },
  scoreBarFill: { height: 2, backgroundColor: C.orange },
  scoreMeta: { color: C.cream, fontSize: 7, letterSpacing: 1, opacity: 0.2, marginTop: 4 },
  cardsRow: { flexDirection: 'row', gap: 2, marginTop: 32 },
  card: { flex: 1, padding: '20 16', backgroundColor: '#1f2937', borderWidth: 1, borderColor: '#222' },
  cardPages: { color: C.orange, fontSize: 7, letterSpacing: 2, marginBottom: 6, opacity: 0.6 },
  cardTitle: { fontSize: 22, color: C.cream, marginBottom: 4, fontFamily: 'Helvetica-Bold' },
  cardMeta: { color: C.cream, fontSize: 8, opacity: 0.3 },
  cardBar: { height: 1, backgroundColor: '#374151', marginTop: 12, marginBottom: 3 },
  cardBarFill: { height: 1, backgroundColor: C.orange },
  cardPct: { color: C.orange, fontSize: 7, letterSpacing: 1, opacity: 0.5 },
  heroImage: { width: '100%', height: 190, objectFit: 'cover' },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  fieldLabel: { fontSize: 7.5, color: '#4a4540', fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, marginRight: 8 },
  fieldLabelLine: { flex: 1, height: 0.5, backgroundColor: C.line },
  fieldSub: { fontSize: 7, color: C.mid, marginBottom: 5 },
  fieldValue: { fontSize: 8.5, color: C.dark, lineHeight: 1.6, marginBottom: 12 },
  fieldEmpty: { fontSize: 8.5, color: C.dark, lineHeight: 1.6, minHeight: 24, marginBottom: 12 },
  grid2: { flexDirection: 'row', gap: 20 },
  grid3: { flexDirection: 'row', gap: 14 },
  col: { flex: 1 },
  groupLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2, marginTop: 6 },
  groupLabel: { fontSize: 7.5, color: '#4a4540', fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, marginRight: 8 },
  groupLabelLine: { flex: 1, height: 0.5, backgroundColor: C.line },
  groupSub: { fontSize: 7, color: C.mid, marginBottom: 6 },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: C.line },
  kvLabel: { fontSize: 7.5, color: C.mid },
  kvValue: { fontSize: 7.5, color: C.dark, fontFamily: 'Helvetica-Bold' },
  kpiHeader: { flexDirection: 'row', paddingBottom: 3, marginBottom: 2, borderBottomWidth: 0.5, borderBottomColor: C.line },
  kpiHeaderText: { fontSize: 6.5, color: C.mid, letterSpacing: 1 },
  kpiRow: { flexDirection: 'row', paddingVertical: 3.5, borderBottomWidth: 0.5, borderBottomColor: C.line },
  kpiLabel: { flex: 3, fontSize: 7.5, color: C.dark },
  kpiVal: { flex: 1, fontSize: 7.5, color: C.mid, textAlign: 'right' },
  kpiValBold: { flex: 1, fontSize: 7.5, color: C.dark, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  okrTable: { borderWidth: 0.5, borderColor: C.line, marginBottom: 8 },
  okrHeader: { backgroundColor: '#ede9e4', padding: '3 8', borderBottomWidth: 0.5, borderBottomColor: C.line },
  okrHeaderText: { fontSize: 7, color: C.mid, letterSpacing: 1 },
  okrBody: { flexDirection: 'row' },
  okrCell: { flex: 1, padding: '5 8', borderRightWidth: 0.5, borderRightColor: C.line },
  okrCellLast: { flex: 1, padding: '5 8' },
  okrCellValue: { fontSize: 7.5, color: C.dark, lineHeight: 1.5, minHeight: 16 },
  numbersRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  numberCell: { flex: 1, alignItems: 'center', paddingVertical: 7, borderWidth: 0.5, borderColor: C.line },
  numberCellLabel: { fontSize: 6, color: C.mid, letterSpacing: 1, marginBottom: 2 },
  numberCellValue: { fontSize: 14, color: C.dark, fontFamily: 'Helvetica-Bold' },
  footer: { position: 'absolute', bottom: 18, left: 28, right: 28, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerLight: { color: C.mid, fontSize: 6, letterSpacing: 1, opacity: 0.6 },
  footerDark: { color: C.cream, fontSize: 6, letterSpacing: 1, opacity: 0.2 },
  footerPage: { color: C.orange, fontSize: 7, letterSpacing: 1, opacity: 0.5 },
  bw: { padding: '14 28', backgroundColor: '#ffffff' },
  bs: { padding: '14 28', backgroundColor: '#f5f3f0' },
})

function get(answers, prefix, id) {
  return answers.find(r => r.question_id === `${prefix}_${id}`)?.answer?.trim() || ''
}
function countFilled(answers, prefix, ids) {
  return ids.filter(id => get(answers, prefix, id).length > 0).length
}
function pct(n, total) { return total > 0 ? Math.round((n / total) * 100) : 0 }
function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}

function FL({ label }) {
  return (
    <View style={s.fieldLabelRow}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.fieldLabelLine} />
    </View>
  )
}

function Field({ label, sub, value }) {
  return (
    <View>
      <FL label={label} />
      {sub ? <Text style={s.fieldSub}>{sub}</Text> : null}
      <Text style={value ? s.fieldValue : s.fieldEmpty}>{value}</Text>
    </View>
  )
}

function GL({ label, sub }) {
  return (
    <View>
      <View style={s.groupLabelRow}>
        <Text style={s.groupLabel}>{label}</Text>
        <View style={s.groupLabelLine} />
      </View>
      {sub ? <Text style={s.groupSub}>{sub}</Text> : null}
    </View>
  )
}

function Hero({ pageNum }) {
  return (
    <View style={{ height: 190 }}>
      <Image src={HERO[pageNum]} style={s.heroImage} />
    </View>
  )
}

function Footer({ label, page, dark }) {
  return (
    <View style={s.footer} fixed>
      <Text style={dark ? s.footerDark : s.footerLight}>ROYAL DUTCH SALES | RDS CANVAS</Text>
      <Text style={dark ? s.footerDark : s.footerLight}>{label}</Text>
      <Text style={s.footerPage}>{page}</Text>
    </View>
  )
}

function StrategiePage1({ answers }) {
  const g = id => get(answers, 'strategie', id)
  return (
    <Page size="A4" style={s.pageLight}>
      <Hero pageNum={1} />

      <View style={s.bw}>
        <View style={s.grid2}>
          <View style={s.col}><Field label="MISSIE" sub="Reden van bestaan" value={g('missie')} /></View>
          <View style={s.col}>
            <GL label="CULTUUR" sub="DNA, kernwaarden en gedrag" />
            {[1,2,3,4,5].map(i => (
              <View key={i} style={{ flexDirection: 'row', gap: 5, marginBottom: 4 }}>
                <Text style={{ fontSize: 7.5, color: C.orange, opacity: 0.5 }}>{i}</Text>
                <View style={{ flex: 1, borderBottomWidth: 0.5, borderBottomColor: C.line, paddingBottom: 2 }}>
                  <Text style={{ fontSize: 8, color: C.dark }}>{g(`cultuur_${i}`)}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={s.bs}>
        <View style={s.grid3}>
          <View style={s.col}><Field label="WAARDEPROPOSITIE" sub="Welk voordeel bieden we?" value={g('waardepropositie')} /></View>
          <View style={s.col}><Field label="KERNCOMPETENTIES" sub="Waarin verschillen we van anderen?" value={g('kerncompetenties')} /></View>
          <View style={s.col}><Field label="DIENSTVERLENING" sub="Wat kopen klanten van ons?" value={g('dienstverlening')} /></View>
        </View>
      </View>

      <View style={s.bw}>
        <View style={s.grid3}>
          <View style={s.col}><Field label="ZANDBAK" sub="Marktsegmenten / Niches / Kernklanten" value={g('zandbak')} /></View>
          <View style={s.col}>
            <GL label="DOELEN (3-5 JR)" />
            {[['doelen_datum','Datum'],['doelen_omzet','Omzet €'],['doelen_winst','Winst €'],['doelen_klanten','Klanten #'],['doelen_marktaandeel','Marktaandeel %'],['doelen_liquiditeit','Liquiditeit %']].map(([id,lbl]) => (
              <View key={id} style={s.kvRow}><Text style={s.kvLabel}>{lbl}</Text><Text style={s.kvValue}>{g(id)}</Text></View>
            ))}
          </View>
          <View style={s.col}>
            <GL label="ACTIES (1 JR)" />
            {[['acties_datum','Datum'],['acties_omzet','Omzet €'],['acties_winst','Winst €'],['acties_brutomarge','Brutomarge %'],['acties_cash','Cash €'],['acties_klanten','Klanten #']].map(([id,lbl]) => (
              <View key={id} style={s.kvRow}><Text style={s.kvLabel}>{lbl}</Text><Text style={s.kvValue}>{g(id)}</Text></View>
            ))}
          </View>
        </View>
      </View>

      <View style={s.bs}>
        <View style={s.grid2}>
          <View style={s.col}><Field label="LEIDERSCHAP" sub="Welke markt(en) willen we domineren?" value={g('leiderschap_markten')} /></View>
          <View style={s.col}><Field label="WANNEER?" sub="" value={g('leiderschap_wanneer')} /></View>
        </View>
      </View>

      <Footer label="STRATEGIE" page="01" />
    </Page>
  )
}

function StrategiePage2({ answers }) {
  const g = id => get(answers, 'strategie', id)
  return (
    <Page size="A4" style={s.pageLight}>
      <Hero pageNum={2} />

      <View style={s.bw}>
        <View style={s.grid3}>
          <View style={s.col}><Field label="MERKBELOFTE" sub="Unieke merkbeloftes en garanties" value={g('merkbelofte')} /></View>
          <View style={s.col}><Field label="STRATEGIE IN 1 ZIN" sub="Hoe onderscheiden we ons?" value={g('strategie_1_zin')} /></View>
          <View style={s.col}>
            <GL label="ONDERSCHEIDEND VERMOGEN" sub="Welke kernactiviteiten ondersteunen de strategie?" />
            {[1,2,3,4,5].map(i => (
              <View key={i} style={{ flexDirection: 'row', gap: 5, marginBottom: 4 }}>
                <Text style={{ fontSize: 7.5, color: C.orange, opacity: 0.5 }}>{i}</Text>
                <View style={{ flex: 1, borderBottomWidth: 0.5, borderBottomColor: C.line, paddingBottom: 2 }}>
                  <Text style={{ fontSize: 8, color: C.dark }}>{g(`onderscheidend_${i}`)}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={s.bs}>
        <View style={s.grid3}>
          <View style={s.col}><Field label="X-FACTOR" sub="10X meerwaarde" value={g('xfactor')} /></View>
          <View style={s.col}><Field label="WINST PER EENHEID" sub="Economische motor" value={g('winst_per_eenheid')} /></View>
          <View style={s.col}><Field label="MOONSHOTS" sub="+1000%" value={g('moonshots')} /></View>
        </View>
      </View>

      <View style={s.bw}>
        <Field label="SCHAALBAARHEID" sub="Hoe maken we onze dienstverlening schaalbaar?" value={g('schaalbaarheid')} />
      </View>

      <View style={s.bs}>
        <View style={s.grid3}>
          <View style={s.col}><Field label="REPETERENDE OMZET" sub="Hoe blijven we klanten binden?" value={g('repeterende_omzet')} /></View>
          <View style={s.col}><Field label="KLANTRETENTIE" sub="Hoe leveren we continue waarde?" value={g('klantretentie')} /></View>
          <View style={s.col}><Field label="REFERRALS" sub="Hoe maken we ambassadeurs?" value={g('referrals')} /></View>
        </View>
      </View>

      <View style={s.bw}>
        <Field label="OMTM" sub="Wat is de belangrijkste prestatie-indicator?" value={g('omtm')} />
      </View>

      <Footer label="STRATEGIE" page="02" />
    </Page>
  )
}

function MensenPage1({ answers }) {
  const g = id => get(answers, 'mensen', id)
  return (
    <Page size="A4" style={s.pageLight}>
      <Hero pageNum={3} />

      <View style={s.bw}>
        <View style={s.grid2}>
          <View style={s.col}><Field label="AANTREKKINGSKRACHT" sub="Waarom werken mensen voor ons?" value={g('aantrekkingskracht')} /></View>
          <View style={s.col}><Field label="PROFIELEN" sub="Welke salesprofielen hebben we nodig?" value={g('profielen')} /></View>
        </View>
      </View>

      <View style={s.bs}>
        <View style={s.grid3}>
          <View style={s.col}><Field label="WERVINGSKANALEN" sub="Via welke kanalen vinden we toptalent?" value={g('wervingskanalen')} /></View>
          <View style={s.col}><Field label="SELECTIEPROCES" sub="Hoe krijgen we toptalent aan boord?" value={g('selectieproces')} /></View>
          <View style={s.col}><Field label="BEHOUD STERSPELERS" sub="Hoe houden we sterspelers?" value={g('behoud_sterspelers')} /></View>
        </View>
      </View>

      <View style={s.bw}>
        <GL label="BENODIGDE CAPACITEIT" sub="Hoeveel verkopers hebben we nodig om het jaardoel te halen?" />
        <View style={s.grid2}>
          {['q1','q2','q3','q4'].map(q => (
            <View key={q} style={[s.col, { marginBottom: 8 }]}>
              <View style={[s.groupLabelRow, { marginBottom: 4 }]}>
                <Text style={s.groupLabel}>{q.toUpperCase()}</Text>
                <View style={s.groupLabelLine} />
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <View style={s.kvRow}><Text style={s.kvLabel}># verkopers</Text><Text style={s.kvValue}>{g(`verkopers_${q}_aantal`)}</Text></View>
                  <View style={s.kvRow}><Text style={s.kvLabel}># die blijven</Text><Text style={s.kvValue}>{g(`verkopers_${q}_blijven`)}</Text></View>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.kvRow}><Text style={s.kvLabel}># uitbreiding</Text><Text style={s.kvValue}>{g(`verkopers_${q}_uitbreiding`)}</Text></View>
                  <View style={s.kvRow}><Text style={s.kvLabel}># nieuwe sales</Text><Text style={s.kvValue}>{g(`verkopers_${q}_nieuw`)}</Text></View>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      <Footer label="MENSEN" page="03" />
    </Page>
  )
}

function MensenPage2({ answers }) {
  const g = id => get(answers, 'mensen', id)
  return (
    <Page size="A4" style={s.pageLight}>
      <Hero pageNum={4} />

      <View style={s.bw}>
        <View style={s.grid2}>
          <View style={s.col}><Field label="WERVING EN SELECTIE" sub="Hoeveel tijd van vacature tot eerste werkdag?" value={g('werving_selectie')} /></View>
          <View style={s.col}><Field label="ONBOARDING" sub="Binnen hoeveel maanden realiseert een verkoper 100%?" value={g('onboarding')} /></View>
        </View>
      </View>

      <View style={s.bs}>
        <Field label="TIJD TOT VOLLEDIG RENDEMENT" sub="Hoeveel tijd van vacature tot 100% doelstelling?" value={g('tijd_rendement')} />
      </View>

      <View style={s.bw}>
        <Field label="ACTIEPLAN" sub="" value={g('actieplan')} />
      </View>

      <Footer label="MENSEN" page="04" />
    </Page>
  )
}

function UitvoeringPage1({ answers }) {
  const g = id => get(answers, 'uitvoering', id)
  return (
    <Page size="A4" style={s.pageLight}>
      <Hero pageNum={5} />

      <View style={s.bw}>
        <GL label="KWARTAALTHEMA" />
        <View style={s.grid2}>
          <View style={s.col}>
            <View style={s.kvRow}><Text style={s.kvLabel}>Kwartaal/Jaar</Text><Text style={s.kvValue}>{g('kwartaal_jaar')}</Text></View>
            <View style={s.kvRow}><Text style={s.kvLabel}>Themanaam</Text><Text style={s.kvValue}>{g('themanaam')}</Text></View>
          </View>
          <View style={s.col}>
            <View style={s.kvRow}><Text style={s.kvLabel}>Meetbaar doel</Text><Text style={s.kvValue}>{g('meetbaar_doel')}</Text></View>
            <View style={s.kvRow}><Text style={s.kvLabel}>Cruciale KPI</Text><Text style={s.kvValue}>{g('cruciale_kpi')}</Text></View>
          </View>
        </View>
      </View>

      <View style={s.bs}>
        <View style={[s.groupLabelRow, { marginBottom: 6 }]}>
          <Text style={s.groupLabel}>DOELSTELLINGEN (WAT)</Text>
          <View style={{ flex: 2, height: 0.5, backgroundColor: C.line, marginHorizontal: 6 }} />
          <Text style={s.groupLabel}>KERNRESULTATEN (HOE)</Text>
          <View style={{ flex: 1, height: 0.5, backgroundColor: C.line, marginHorizontal: 6 }} />
          <Text style={s.groupLabel}>WIE</Text>
        </View>
        {[1,2,3].map(n => (
          <View key={n} style={s.okrTable}>
            <View style={s.okrHeader}><Text style={s.okrHeaderText}>{n}.</Text></View>
            <View style={s.okrBody}>
              <View style={s.okrCell}><Text style={s.okrCellValue}>{g(`okr_wat_${n}`)}</Text></View>
              <View style={s.okrCell}><Text style={s.okrCellValue}>{g(`okr_hoe_${n}`)}</Text></View>
              <View style={s.okrCellLast}><Text style={s.okrCellValue}>{g(`okr_wie_${n}`)}</Text></View>
            </View>
          </View>
        ))}
      </View>

      <View style={s.bw}>
        <View style={s.grid3}>
          {[
            { key: 'krijgen', label: 'KLANTEN KRIJGEN', sub: 'Effectieve Leadgeneratie' },
            { key: 'uitbouwen', label: 'KLANTEN UITBOUWEN', sub: '100% Klantaandeel' },
            { key: 'houden', label: 'KLANTEN HOUDEN', sub: 'Levenslange Retentie' },
          ].map(({ key, label, sub }) => (
            <View key={key} style={s.col}>
              <GL label={label} sub={sub} />
              {[1,2,3].map(n => (
                <View key={n} style={{ flexDirection: 'row', gap: 4, marginBottom: 5 }}>
                  <Text style={{ fontSize: 7.5, color: C.orange, opacity: 0.5 }}>{n}</Text>
                  <Text style={{ fontSize: 8, color: C.dark, flex: 1, lineHeight: 1.4 }}>{g(`klanten_${key}_${n}`)}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>

      <Footer label="UITVOERING" page="05" />
    </Page>
  )
}

function UitvoeringPage2({ answers }) {
  const g = id => get(answers, 'uitvoering', id)
  return (
    <Page size="A4" style={s.pageLight}>
      <Hero pageNum={6} />

      <View style={s.bw}>
        <GL label="AANTALLEN & CONVERSIES" />
        <View style={s.numbersRow}>
          {[['numbers_leads','#LEADS'],['numbers_bezoeken','#BEZOEKEN'],['numbers_offertes','#OFFERTES'],['numbers_orders','#ORDERS'],['numbers_referrals','#REFERRALS']].map(([id,lbl]) => (
            <View key={id} style={s.numberCell}>
              <Text style={s.numberCellLabel}>{lbl}</Text>
              <Text style={s.numberCellValue}>{g(id) || '-'}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={s.bs}>
        <GL label="DOELEN EN KEY PERFORMANCE INDICATOREN - DASHBOARD" />
        <View style={s.kpiHeader}>
          <Text style={[s.kpiHeaderText, { flex: 3 }]}>KPI</Text>
          <Text style={[s.kpiHeaderText, { flex: 1, textAlign: 'right' }]}>DOEL</Text>
          <Text style={[s.kpiHeaderText, { flex: 1, textAlign: 'right' }]}>REALISATIE</Text>
        </View>
        {[['kpi_verkoopcyclus','Verkoopcyclus (doorlooptijd)'],['kpi_conversieratio','Conversieratio'],['kpi_klantaandeel','% Klantaandeel'],['kpi_klantretentie','% Klantretentie'],['kpi_forecast','% Behaalde Forecast'],['kpi_ordergrootte','€ Gem. Ordergrootte'],['kpi_nieuwe_logos',"# Nieuwe Logo's"],['kpi_omzet','€ Omzet'],['kpi_winst','€/% Winst'],['kpi_referrals','# Referrals']].map(([id,lbl]) => (
          <View key={id} style={s.kpiRow}>
            <Text style={s.kpiLabel}>{lbl}</Text>
            <Text style={s.kpiVal}>{g(`${id}_doel`) || ''}</Text>
            <Text style={s.kpiValBold}>{g(`${id}_real`) || g(id) || ''}</Text>
          </View>
        ))}
      </View>

      <View style={s.bw}>
        <Field label="WENSENLIJST" sub="Nieuwe Logo's (Olifanten)" value={g('wensenlijst')} />
      </View>

      <View style={s.bs}>
        <Field label="VERKOOPPROCES / KLANTREIS" sub="Hoe ziet ons verkoopproces en klantreis er uit?" value={g('verkoopproces')} />
      </View>

      <View style={s.bw}>
        <View style={s.grid2}>
          <View style={s.col}><Field label="BOUW EEN FEESTJE" sub="Hoe vieren we onze successen?" value={g('feestje')} /></View>
          <View style={s.col}><Field label="BELONING" sub="Hoe belonen we betrokken medewerkers?" value={g('beloning')} /></View>
        </View>
      </View>

      <Footer label="UITVOERING" page="06" />
    </Page>
  )
}

function CoverPage({ answers, healthScore, kwaliteitsScore, userName, laatsteAnalyse }) {
  const SF = ['missie','cultuur_1','cultuur_2','cultuur_3','cultuur_4','cultuur_5','waardepropositie','kerncompetenties','dienstverlening','zandbak','doelen_datum','doelen_omzet','doelen_winst','doelen_klanten','doelen_marktaandeel','doelen_liquiditeit','acties_datum','acties_omzet','acties_winst','acties_brutomarge','acties_cash','acties_klanten','leiderschap_markten','leiderschap_wanneer','merkbelofte','strategie_1_zin','onderscheidend_1','onderscheidend_2','onderscheidend_3','onderscheidend_4','onderscheidend_5','xfactor','winst_per_eenheid','moonshots','schaalbaarheid','repeterende_omzet','klantretentie','referrals','omtm']
  const MF = ['aantrekkingskracht','profielen','wervingskanalen','selectieproces','behoud_sterspelers','verkopers_q1','verkopers_q2','verkopers_q3','verkopers_q4','werving_selectie','onboarding','tijd_rendement','actieplan']
  const UF = ['kwartaal_jaar','themanaam','meetbaar_doel','cruciale_kpi','okr_wat_1','okr_hoe_1','okr_wie_1','okr_wat_2','okr_hoe_2','okr_wie_2','okr_wat_3','okr_hoe_3','okr_wie_3','klanten_krijgen_1','klanten_krijgen_2','klanten_krijgen_3','klanten_uitbouwen_1','klanten_uitbouwen_2','klanten_uitbouwen_3','klanten_houden_1','klanten_houden_2','klanten_houden_3','numbers_leads','numbers_bezoeken','numbers_offertes','numbers_orders','numbers_referrals','wensenlijst','kpi_verkoopcyclus','kpi_omzet','kpi_winst','verkoopproces','feestje','beloning']
  const sections = [
    { key: 'strategie', label: 'STRATEGIE', pages: '01-02', fields: SF },
    { key: 'mensen', label: 'MENSEN', pages: '03-04', fields: MF },
    { key: 'uitvoering', label: 'UITVOERING', pages: '05-06', fields: UF },
  ]
  return (
    <Page size="A4" style={s.pageDark}>
      <View style={{ marginBottom: 48 }}>
        <Text style={s.coverLabel}>ROYAL DUTCH SALES</Text>
        <Text style={s.coverTitle}>RDS{'\n'}CANVAS</Text>
        <Text style={s.coverSub}>{userName}, Verkoopplan {new Date().getFullYear()}</Text>
      </View>
      <View style={s.coverDivider} />
      <View style={{ marginBottom: 24 }}>
        <Text style={s.scoreLabel}>VOLLEDIGHEID</Text>
        <Text style={s.scoreNumber}>{healthScore}%</Text>
        <View style={s.scoreBar}><View style={[s.scoreBarFill, { width: `${healthScore}%` }]} /></View>
      </View>
      <View style={{ paddingTop: 20, borderTopWidth: 1, borderTopColor: C.subtle, marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={s.scoreLabel}>PLAN KWALITEIT</Text>
          <Text style={{ color: C.cream, fontSize: 6.5, opacity: 0.2 }}>MENSEN 40% · STRATEGIE 30% · UITVOERING 30%</Text>
        </View>
        <Text style={[s.scoreNumber, { color: kwaliteitsScore !== null ? C.cream : C.subtle }]}>
          {kwaliteitsScore !== null ? `${kwaliteitsScore}%` : '-'}
        </Text>
        {kwaliteitsScore !== null && (
          <View style={s.scoreBar}><View style={[s.scoreBarFill, { width: `${kwaliteitsScore}%` }]} /></View>
        )}
        {laatsteAnalyse && <Text style={s.scoreMeta}>LAATSTE ANALYSE: {formatDate(laatsteAnalyse)}</Text>}
      </View>
      <View style={s.cardsRow}>
        {sections.map(sec => {
          const filled = countFilled(answers, sec.key, sec.fields)
          const p = pct(filled, sec.fields.length)
          return (
            <View key={sec.key} style={s.card}>
              <Text style={s.cardPages}>{sec.pages}</Text>
              <Text style={s.cardTitle}>{sec.label}</Text>
              <Text style={s.cardMeta}>{filled} / {sec.fields.length} velden</Text>
              <View style={s.cardBar}><View style={[s.cardBarFill, { width: `${p}%` }]} /></View>
              <Text style={s.cardPct}>{p}%</Text>
            </View>
          )
        })}
      </View>
      <Footer label="COVER" page="" dark />
    </Page>
  )
}

export function CanvasPdfDocument({ answers, healthScore, kwaliteitsScore, userName, laatsteAnalyse }) {
  return (
    <Document title={`RDS Canvas - ${userName}`} author="Royal Dutch Sales" subject="Verkoopplan">
      <CoverPage answers={answers} healthScore={healthScore} kwaliteitsScore={kwaliteitsScore} userName={userName} laatsteAnalyse={laatsteAnalyse} />
      <StrategiePage1 answers={answers} />
      <StrategiePage2 answers={answers} />
      <MensenPage1 answers={answers} />
      <MensenPage2 answers={answers} />
      <UitvoeringPage1 answers={answers} />
      <UitvoeringPage2 answers={answers} />
    </Document>
  )
}
