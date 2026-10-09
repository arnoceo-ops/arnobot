// Nederlandse btw-nummers: NL + 9 cijfers + B + 2 cijfers. Voor de livegang alleen NL
// (besloten 2026-10-10); een buitenlands nummer wordt netjes geweigerd met een verwijzing
// naar contact.

export function normaliseerBtwNummer(raw: string): string {
  return raw.replace(/[\s.\-]/g, '').toUpperCase()
}

export function isNlBtwFormaat(raw: string): boolean {
  return /^NL\d{9}B\d{2}$/.test(normaliseerBtwNummer(raw))
}

export function isKvkFormaat(raw: string): boolean {
  return /^\d{8}$/.test(raw.replace(/\s/g, ''))
}

export type VatCheck = 'geldig' | 'ongeldig' | 'onbekend'

/**
 * Controleert het nummer bij de EU-dienst VIES. Valt de dienst uit of is hij traag, dan
 * geeft dit 'onbekend' terug: de aankoop mag doorgaan en het nummer staat als
 * "niet gevalideerd" in de administratie (btw_gevalideerd = false) zodat het achteraf
 * te controleren is. Een nummer dat VIES expliciet als ongeldig afwijst blokkeert wel.
 */
export async function controleerBtwBijVies(raw: string): Promise<VatCheck> {
  const nummer = normaliseerBtwNummer(raw)
  if (!isNlBtwFormaat(nummer)) return 'ongeldig'
  try {
    const res = await fetch(
      `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/NL/vat/${encodeURIComponent(nummer.slice(2))}`,
      { signal: AbortSignal.timeout(4000), headers: { Accept: 'application/json' } },
    )
    if (!res.ok) return 'onbekend'
    const data = (await res.json()) as { isValid?: boolean; valid?: boolean }
    const geldig = data.isValid ?? data.valid
    if (geldig === true) return 'geldig'
    if (geldig === false) return 'ongeldig'
    return 'onbekend'
  } catch {
    return 'onbekend'
  }
}
