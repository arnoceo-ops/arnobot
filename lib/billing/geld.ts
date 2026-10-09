// Alle bedragen in de billing-code zijn gehele centen (integer). Floats alleen op de
// rand: Mollie wil een string met twee decimalen ("29.00").

export function centenNaarMollie(cent: number): string {
  if (!Number.isInteger(cent) || cent < 0) throw new Error('Ongeldig bedrag in centen')
  const euro = Math.floor(cent / 100)
  const rest = cent % 100
  return `${euro}.${rest.toString().padStart(2, '0')}`
}

export function mollieNaarCenten(value: string): number {
  const m = /^(\d+)\.(\d{2})$/.exec(value)
  if (!m) throw new Error('Ongeldig Mollie-bedrag')
  return Number(m[1]) * 100 + Number(m[2])
}

export function formatEuro(cent: number): string {
  return `€${(cent / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
