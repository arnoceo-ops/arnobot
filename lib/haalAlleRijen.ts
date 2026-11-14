// De database (PostgREST) geeft per vraag hooguit 1000 rijen terug, ook bij .limit(5000) of
// .limit(100000). Gemeten 2026-11-14: blog_chunks heeft 1540 rijen, een select zonder limit en
// eentje met .limit(5000) gaven allebei 1000. Wie alle rijen nodig heeft voor een telling,
// ranglijst of analyse, haalt ze daarom in blokken op via deze functie.
//
// Gebruik:
//   const logs = await haalAlleRijen<{ user_id: string; created_at: string }>((van, tot) =>
//     supabase.from('arnobot_rds_logs').select('user_id, created_at')
//       .order('created_at', { ascending: false }).order('id').range(van, tot))
//
// Belangrijk: de query moet een vaste volgorde hebben, liefst eindigend op een unieke kolom
// (.order('id')). Zonder volgorde, of met alleen een kolom met dubbele waarden zoals
// created_at, kan een rij tussen twee blokken dubbel voorkomen of ontbreken.
// scripts/check-row-limit.mjs dwingt in CI af dat grote tabellen hierlangs lopen of een
// bewuste bovengrens hebben.

type Resultaat<T> = { data: T[] | null; error: { message: string } | null }

export const BLOKGROOTTE = 1000

export async function haalAlleRijen<T>(
  bouw: (van: number, tot: number) => PromiseLike<Resultaat<T>>,
  opties: { blok?: number; max?: number } = {},
): Promise<T[]> {
  const blok = opties.blok ?? BLOKGROOTTE
  const max = opties.max ?? 100_000
  const alles: T[] = []
  for (let van = 0; ; van += blok) {
    const { data, error } = await bouw(van, van + blok - 1)
    if (error) throw new Error(`haalAlleRijen: ${error.message}`)
    const rijen = data ?? []
    alles.push(...rijen)
    if (alles.length > max) throw new Error(`haalAlleRijen: meer dan ${max} rijen, vraag een kleiner bereik op`)
    if (rijen.length < blok) return alles
  }
}
