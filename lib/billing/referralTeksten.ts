import type { ReserveerInvoer } from './referralTerugstorten'

// Wat de klant bij een terugstorting te zien krijgt: de omschrijving gaat mee naar Mollie. Hoe de bank haar op het
// rekeningafschrift toont is niet beproefd. Klanttekst, vastgesteld door de eigenaar op 26-11-2026: niet zonder akkoord
// wijzigen. Een soort zonder tekst wordt niet gereserveerd. Er wordt alleen iets verplaatst met REFERRAL_TERUGSTORTEN aan.
export const TERUGSTORT_OMSCHRIJVING: Partial<Record<ReserveerInvoer['soort'], string>> = {
  voordeel_maand: 'ArnoBot referral fee: gratis vierde maand',
  voordeel_jaar: 'ArnoBot referral fee: korting jaarabonnement',
  tegoed_terugstorten: 'ArnoBot referraltegoed verrekend',
}
