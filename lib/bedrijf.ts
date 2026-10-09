// Centrale bron voor de bedrijfsgegevens die publiek zichtbaar zijn: footer, /contact,
// Organization-JSON-LD en de afzenderregel onderaan e-mails. Een wijziging (nieuw adres,
// btw-nummer na ontvangst) gebeurt hier op één plek. De juridische tekst op /privacy en
// /voorwaarden staat bewust los en wordt apart bijgehouden.
export const BEDRIJF = {
  naam: 'ArnoBot',
  eigenaar: 'Anton Dirk Diepeveen',
  kvk: '42184446',
  // Invullen zodra ontvangen; footer, /contact en JSON-LD tonen het dan vanzelf.
  btw: '' as string,
  straat: 'Oudegracht 161',
  postcode: '3511 AL',
  plaats: 'Utrecht',
  land: 'Nederland',
  landCode: 'NL',
  emailAlgemeen: 'hq@arno.bot',
  emailPrivacy: 'privacy@arno.bot',
  emailOpzeggen: 'cancel@arno.bot',
  reactietermijn: 'binnen 24 uur',
} as const

export const BEDRIJF_ADRES_REGEL = `${BEDRIJF.straat}, ${BEDRIJF.postcode} ${BEDRIJF.plaats}`

// Eén regel voor footer en e-mails: naam, KvK, (btw), adres.
export const BEDRIJF_REGEL = [
  BEDRIJF.naam,
  `KvK ${BEDRIJF.kvk}`,
  ...(BEDRIJF.btw ? [`Btw ${BEDRIJF.btw}`] : []),
  BEDRIJF_ADRES_REGEL,
].join(' · ')
