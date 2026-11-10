// Titels voor de gedeelde gesprekspagina (/gesprek/[token]).
// `title` in arnobot_blog_sessions is de eerste vraag (eerste 100 tekens), dus als kop weinig waard.
// `onderwerp` is het korte, neutrale label (max 8 woorden) dat bij het afsluiten wordt gemaakt
// (lib/memoryLabels.ts). Bestaat dat, dan is dat de titel; anders een ingekorte vraag.

export function kortTitel(t: string, max = 80): string {
  if (t.length <= max) return t
  const knip = t.slice(0, max)
  const spatie = knip.lastIndexOf(' ')
  return (spatie > max / 2 ? knip.slice(0, spatie) : knip).trimEnd() + '…'
}

type Bron = { onderwerp?: string | null; title?: string | null }

// Titel voor tabblad, linkpreview en OG-afbeelding: altijd gevuld.
export function metaTitel(s: Bron | null | undefined, max = 60): string {
  const onderwerp = s?.onderwerp?.trim()
  if (onderwerp) return kortTitel(onderwerp, max)
  const title = s?.title?.trim()
  return title ? kortTitel(title, max) : 'Gesprek met ArnoBot'
}

// Zichtbare kop op de pagina: alleen een echt onderwerp, nooit een kopie van de vraag.
export function paginaKop(s: Bron | null | undefined): string | null {
  const onderwerp = s?.onderwerp?.trim()
  return onderwerp ? kortTitel(onderwerp, 80) : null
}
