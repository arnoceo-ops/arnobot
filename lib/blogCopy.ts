// Alle zichtbare teksten van de publieke blog en de blogmails op een plek, zodat een
// tekstcorrectie een wijziging van één regel is. Regels: jij/jou, geen streepjes als
// leesteken, geen tijdsdruk. Nieuwe of gewijzigde tekst eerst aan Arno voorleggen.

export const BLOG_COPY = {
  overzicht: {
    label: 'Blog',
    titel: 'ArnoBot Best Practices',
    sub: 'Nieuwe functionaliteiten en hoe je ArnoBot voor je kunt laten werken',
    // Bewust leeg: zolang er geen posts zijn toont het overzicht geen lege-staat-tekst.
    leeg: '',
    zoekPlaceholder: 'Zoek op hashtag of trefwoord',
    geenResultaat: 'Geen artikelen gevonden.',
    toonMeer: 'Toon meer',
    resultaten: (n: number) => `${n} ${n === 1 ? 'artikel' : 'artikelen'}`,
    metaTitel: 'ArnoBot Blog',
    metaBeschrijving: 'Nieuwe functionaliteiten en hoe je ArnoBot voor je kunt laten werken',
  },
  tag: {
    sub: (tag: string) => `Alle artikelen over ${tag}.`,
    leeg: 'Over dit onderwerp staat nog niets.',
    terug: 'Alle artikelen',
  },
  artikel: {
    leestijd: (min: number) => `${min} min leestijd`,
    terug: 'Alle artikelen',
    gerelateerd: 'Meer om te lezen',
  },
  abonneer: {
    kop: "Abonneer je op ArnoBot's blog",
    tekst: 'Afmelden kan altijd met één klik.',
    emailPlaceholder: 'Je e-mailadres',
    voornaamPlaceholder: 'Je voornaam',
    voornaamVerplicht: 'Vul je voornaam in.',
    knop: 'Abonneer',
    bezig: 'Bezig',
    geluktKop: 'Check je inbox',
    gelukt: 'Klik op de link in de mail om je aanmelding te bevestigen.',
    ongeldigEmail: 'Dat is geen geldig e-mailadres.',
    fout: 'Er ging iets mis. Probeer het nog eens.',
    teVaak: 'Te veel pogingen. Probeer het later opnieuw.',
    privacyLink: 'Privacyverklaring',
  },
  cta: {
    kop: 'ArnoBot zelf ervaren?',
    tekst: 'Probeer ArnoBot 30 dagen gratis.',
    primair: 'Start gratis',
    secundair: 'Bekijk prijzen',
  },
  bevestig: {
    kop: 'Bevestig je aanmelding',
    tekst: 'Klik op de knop om je aan te melden voor de blogmails van ArnoBot.',
    knop: 'Bevestig aanmelding',
    gelukt: 'Je bent aangemeld. Je ontvangt een mail bij elk nieuw artikel.',
    ongeldig: 'Deze link is ongeldig of al gebruikt.',
    fout: 'Er ging iets mis. Probeer het nog eens.',
  },
  afmelden: {
    kop: 'Afmelden',
    tekst: 'Weet je zeker dat je geen blogmails meer wilt ontvangen?',
    knop: 'Afmelden',
    gelukt: 'Je bent afgemeld. Je krijgt geen blogmails meer van ons.',
    ongeldig: 'Deze link is ongeldig.',
    fout: 'Er ging iets mis. Probeer het nog eens.',
  },
  mail: {
    bevestigOnderwerp: 'Bevestig je aanmelding voor de ArnoBot blog',
    bevestigTekst:
      'Dit e-mailadres is aangemeld voor de blogmails van ArnoBot. Bevestig het met de knop hieronder. Heb jij dit niet gedaan? Dan hoef je niets te doen en krijg je geen mails.',
    bevestigKnop: 'BEVESTIG AANMELDING',
    alAangemeldOnderwerp: 'Je bent al aangemeld voor de ArnoBot blog',
    alAangemeldTekst:
      'Dit e-mailadres staat al op de lijst voor de blogmails van ArnoBot, dus je hoeft niets te bevestigen.',
    alAangemeldKnop: 'NAAR DE BLOG',
    nieuwKnop: 'LEES HET ARTIKEL',
    nieuwVoet: (url: string) =>
      `Geen blogmails meer? <a href="${url}" style="color:#9ca3af;text-decoration:underline;">Klik dan hier.</a>`,
  },
} as const
