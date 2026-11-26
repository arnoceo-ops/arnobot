import { billingDb, type PayRow } from './db'
import { tabelOntbreekt } from './tabel'

// Het gedeelde slot tussen de terugstortmachine en een gewone terugbetaling (knop van de beheerder of herroeping).
// Een Postgres-slot kan niet open blijven tijdens een aanroep bij Mollie. Daarom legt de databasefunctie
// referral_voor_terugbetaling het binnen het slot per gebruiker vast: nieuwe reserveringen op deze betaling zijn tien
// minuten geblokkeerd, wat nog niet verstuurd is wordt vrijgegeven, en wat al onderweg is wordt genoemd.
// SQL: docs/sql/2026-11-26-referral-verrekening.sql. Zolang die niet is uitgevoerd bestaat er niets om te blokkeren.

type DbFout = { code?: string; message: string }

/** Alleen "de functie zelf bestaat niet". Een fout binnen een bestaande functie telt hier nooit als niet geïnstalleerd. */
const functieOntbreekt = (e: DbFout) =>
  (e.code === 'PGRST202' && e.message.includes('referral_voor_terugbetaling'))
  || (e.code === '42883' && /function [^ ]*referral_voor_terugbetaling\(.*does not exist/i.test(e.message))

const actieTabelOntbreekt = (e: DbFout) => e.code === '42P01' || e.code === 'PGRST205' || tabelOntbreekt(e)

export type SlotUitkomst =
  /** De SQL is niet uitgevoerd: er zijn geen referralacties. */
  | { stand: 'niet-geinstalleerd' }
  /** Niet te controleren. De aanroeper kiest wat dan veilig is. */
  | { stand: 'fout'; fout: string }
  | {
    stand: 'ok'
    /** De nieuwe stand van arnobot_payments.referral_refund_cent. */
    referralRefundCent: number
    /** arnobot_payments.referral_bank_cent: per bank teruggegeven. */
    bankCent: number
    /** Al op weg naar de klant (bezig of verzonden). */
    onderwegCent: number
    /** Vastgelopen met de reservering nog geboekt: onduidelijk of dit geld is verplaatst. */
    vastCent: number
  }

export async function slotVoorTerugbetaling(userId: string, betalingId: string): Promise<SlotUitkomst> {
  try {
    const { data, error } = await billingDb.rpc('referral_voor_terugbetaling', { p_user: userId, p_betaling: betalingId })
    if (error) return functieOntbreekt(error) ? { stand: 'niet-geinstalleerd' } : { stand: 'fout', fout: error.message }
    const r = data as { ok?: boolean; reden?: string; referral_refund_cent?: number; referral_bank_cent?: number; onderweg_cent?: number; vast_cent?: number } | null
    if (!r?.ok || typeof r.referral_refund_cent !== 'number') return { stand: 'fout', fout: r?.reden ?? 'onverwacht antwoord' }
    return { stand: 'ok', referralRefundCent: r.referral_refund_cent, bankCent: r.referral_bank_cent ?? 0, onderwegCent: r.onderweg_cent ?? 0, vastCent: r.vast_cent ?? 0 }
  } catch (e) {
    return { stand: 'fout', fout: e instanceof Error ? e.message : String(e) }
  }
}

export interface OpenBedrag {
  /** Gereserveerd en nog niet verstuurd: valt bij een gewone terugbetaling weer vrij. */
  gereserveerdCent: number
  /** Al op weg naar de klant. */
  onderwegCent: number
  /** Vastgelopen met de reservering nog geboekt. */
  vastCent: number
}

/**
 * Welk deel van referral_refund_cent per betaling nog niet af is. Zonder dit zou een betaling met een openstaande
 * reservering lijken alsof er niets meer van terug te betalen is. Vraagt alleen iets aan de database als er op een van
 * de betalingen referralgeld geboekt staat.
 */
export async function openReferralBedragen(betalingen: PayRow[]): Promise<{ bedragen: Map<string, OpenBedrag>; fout: string | null }> {
  const bedragen = new Map<string, OpenBedrag>()
  const ids = betalingen.filter(b => (b.referral_refund_cent ?? 0) > 0).map(b => b.id)
  if (!ids.length) return { bedragen, fout: null }
  try {
    const { data, error } = await billingDb
      .from('arnobot_referral_acties')
      .select('doel_id, bruto_cent, status, gegevens')
      .eq('doel_soort', 'betaling')
      .in('doel_id', ids)
      .in('status', ['gereserveerd', 'bezig', 'verzonden', 'vastgelopen'])
      .limit(200)
    if (error) return { bedragen, fout: actieTabelOntbreekt(error) ? null : error.message }
    for (const a of (data ?? []) as { doel_id: string; bruto_cent: number; status: string; gegevens?: { boeking_teruggezet?: boolean } | null }[]) {
      const som = bedragen.get(a.doel_id) ?? { gereserveerdCent: 0, onderwegCent: 0, vastCent: 0 }
      if (a.status === 'gereserveerd') som.gereserveerdCent += a.bruto_cent
      else if (a.status !== 'vastgelopen') som.onderwegCent += a.bruto_cent
      else if (!a.gegevens?.boeking_teruggezet) som.vastCent += a.bruto_cent
      bedragen.set(a.doel_id, som)
    }
    return { bedragen, fout: null }
  } catch (e) {
    return { bedragen, fout: e instanceof Error ? e.message : String(e) }
  }
}

/** Dezelfde betaling alsof dit referralbedrag er niet op geboekt stond. Alleen om mee te rekenen, nooit om op te slaan. */
export const zonderReferralBedrag = (b: PayRow, cent: number): PayRow =>
  (cent > 0 ? { ...b, referral_refund_cent: Math.max(0, (b.referral_refund_cent ?? 0) - cent) } : b)
