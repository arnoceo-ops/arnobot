// Alle zichtbare teksten van de publieke blog en de blogmails op een plek, zodat een
// tekstcorrectie een wijziging van één regel is. Regels: jij/jou, geen streepjes als
// leesteken, geen tijdsdruk. Nieuwe of gewijzigde tekst eerst aan Arno voorleggen.

export const BLOG_COPY = {
  overzicht: {
    label: 'Blog',
    titel: 'Wat ArnoBot voor jou kan doen',
    sub: 'Hoe ArnoBot werkt, wat je ermee kunt en hoe verkopers en teams het in de praktijk gebruiken.',
    leeg: 'De eerste artikelen komen eraan. Abonneer je, dan krijg je ze als eerste.',
    alleOnderwerpen: 'Alle onderwerpen',
    metaTitel: 'ArnoBot Blog',
    metaBeschrijving: 'Hoe ArnoBot werkt, wat je ermee kunt en hoe verkopers en teams het in de praktijk gebruiken.',
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
    kop: 'Nieuwe artikelen in je inbox',
    tekst: 'Je krijgt een mail bij elk nieuw artikel. Kies alles of alleen de onderwerpen die jou interesseren. Afmelden kan altijd met één klik.',
    emailPlaceholder: 'Je e-mailadres',
    voornaamPlaceholder: 'Je voornaam (optioneel)',
    onderwerpenLabel: 'Waarover wil je lezen?',
    alles: 'Alles',
    knop: 'Abonneer',
    bezig: 'Bezig',
    gelukt: 'Check je inbox. Klik op de link in de mail om je aanmelding te bevestigen.',
    ongeldigEmail: 'Dat is geen geldig e-mailadres.',
    fout: 'Er ging iets mis. Probeer het nog eens.',
    teVaak: 'Te veel pogingen. Probeer het later opnieuw.',
    privacy: 'We gebruiken je e-mailadres alleen voor deze blogmails.',
    privacyLink: 'Privacyverklaring',
  },
  cta: {
    kop: 'Zelf ervaren?',
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
    voorkeuren: 'Liever alleen bepaalde onderwerpen? Pas je voorkeuren aan.',
  },
  voorkeuren: {
    kop: 'Je onderwerpen',
    tekst: 'Kies waarover je mail wilt krijgen.',
    knop: 'Opslaan',
    opgeslagen: 'Opgeslagen.',
    ongeldig: 'Deze link is ongeldig.',
    fout: 'Er ging iets mis. Probeer het nog eens.',
    afmelden: 'Helemaal afmelden',
  },
  mail: {
    bevestigOnderwerp: 'Bevestig je aanmelding voor de ArnoBot blog',
    bevestigTekst:
      'Dit e-mailadres is aangemeld voor de blogmails van ArnoBot. Bevestig het met de knop hieronder. Heb jij dit niet gedaan? Dan hoef je niets te doen en krijg je geen mails.',
    bevestigKnop: 'BEVESTIG AANMELDING',
    nieuwKnop: 'LEES HET ARTIKEL',
    nieuwVoet: (url: string) =>
      `Geen blogmails meer? <a href="${url}" style="color:#9ca3af;text-decoration:underline;">Klik dan hier.</a>`,
    voorkeurenVoet: (url: string) =>
      `<a href="${url}" style="color:#9ca3af;text-decoration:underline;">Onderwerpen aanpassen</a>`,
  },
} as const
