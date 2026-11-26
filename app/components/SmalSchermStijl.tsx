// Gedeelde regels zodat de publieke tekstpagina's op een telefoon binnen de breedte passen, ook
// met vergrote tekst (de Android-app neemt de lettergrootte van het toestel over). !important is
// nodig omdat de koppen hun lettergrootte inline hebben.
export const SMAL_SCHERM_CSS = `
  h1 { font-size: min(64px, 11vw) !important; overflow-wrap: anywhere; }
  h2 { overflow-wrap: anywhere; }
  .contact-links { display: flex; flex-wrap: wrap; row-gap: 12px; }
`

// Tabellen onder elkaar: de eerste cel is de titel van het blok, de kolomkoppen vervallen.
export const GESTAPELDE_TABEL_CSS = `
  @media (max-width: 600px) {
    table, tbody, tr, td { display: block; width: 100% !important; }
    thead { display: none; }
    tr { padding: 10px 0; border-bottom: 1px solid #374151; }
    tr:last-child { border-bottom: none; }
    td { padding: 2px 0 !important; border-bottom: none !important; overflow-wrap: anywhere; }
  }
`

export default function SmalSchermStijl({ gestapeldeTabellen = false }: { gestapeldeTabellen?: boolean }) {
  return <style>{SMAL_SCHERM_CSS + (gestapeldeTabellen ? GESTAPELDE_TABEL_CSS : '')}</style>
}
