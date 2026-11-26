import type { ReserveerInvoer } from './referralTerugstorten'

// Wat de klant bij een terugstorting te zien krijgt (de omschrijving gaat mee naar Mollie en staat op het
// rekeningafschrift). NOG NIET VASTGESTELD: dit is klanttekst en die beslist de eigenaar. Zolang hier niets staat
// reserveert de planner niets, ook niet met REFERRAL_TERUGSTORTEN aan, en blijven de handmatige signalen staan.
export const TERUGSTORT_OMSCHRIJVING: Partial<Record<ReserveerInvoer['soort'], string>> = {}
