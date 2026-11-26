// Loopt het grootboek van het referraltegoed nog mee (regels zonder gevolgen), of telt het echt? Los bestand, zodat ook
// de kleine vragen vanuit de betaalverwerking het kunnen lezen. Wordt pas false bij de livegang van het grootboek
// (docs/REFERRAL_BOUWPLAN_R3.md, B5); tot dan bestaan er geen echte regels en wordt er geen tegoed verrekend.
// VOLGORDE bij livegang: eerst de overgang in de database (docs/sql/2026-11-26-referral-livegang-NIET-UITVOEREN.sql),
// daarna pas REFERRAL_GROOTBOEK_ECHT=true. Staan er dan nog meeloopregels, dan schrijft het grootboek niets.
export const MEELOOP = process.env.REFERRAL_GROOTBOEK_ECHT !== 'true'
